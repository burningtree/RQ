/*
    rq.js

    Douglas Crockford
    2015-04-09
    Public Domain

This package uses four kinds of functions:
    requestor
    callback
    cancel
    factory


requestor(callback [, initial])
    may return a cancel function

    A requestor is a function that makes a request. Such a request need not
    be satisfied immediately. It is likely that the request will not be
    satisfied until some future turn. Requestors provide a means of dealing
    with future activities without blocking.

    A requestor is a function that takes a callback function as its first
    parameter, and optionally an initial value as its second parameter. The
    requestor uses the callback to report its result. A requestor may
    optionally return a cancel function that might be used to cancel the
    request, triggering the callback function with a failure result.

    The initial parameter contains a value that may be used to initialize the
    request. It is provided specifically for RQ.sequence, but it may be passed
    to any requestor.


callback(success, failure)
    returns undefined

    A callback function is used to deliver the result of a request. A callback
    takes two arguments: success and failure. If the request succeeds, then the
    result will be passed to the callback function as the success parameter,
    and the failure parameter will be undefined. If the request fails, then the
    reason will be passed to the callback function as the failure parameter. If
    failure is undefined, then the request succeeded. If failure is any other
    value, then the request failed.


cancel(reason)
    returns undefined

    If a request is likely to be expensive to satisfy, the requestor may
    optionally return a cancel function that would allow the request to be
    cancelled. A requestor is not required to return a cancel function, and
    the cancel function will not be guaranteed to cancel the request. The
    cancel's reason argument may become the callback's failure argument.


factory([arguments])
    returns a requestor function

    A factory function produces requestor functions. A factory function will
    usually take parameters that will customize or specialize a request. It is
    possible to write requestor functions by hand, but it is usually easier to
    generate them with factories.


The RQ object contains four factory functions:

    RQ.fallback(requestors, milliseconds)
    RQ.race(requestors, milliseconds)
    RQ.parallel(requestors, optionals, milliseconds, untilliseconds)
    RQ.sequence(requestors, milliseconds)

Each of these four factory functions returns a requestor function that
returns a cancel function.


RQ.fallback(requestors, milliseconds)

    RQ.fallback returns a requestor function that will call the first element
    in the requestors array. If that is ultimately successful, its value will
    be passed to the callback. But if it fails, the next element will be
    called, and so on. If none of the elements are successful, then the
    fallback fails. If any succeeds, then the fallback succeeds.

    If the optional milliseconds argument is supplied, then if a request is not
    successful in the allotted time, then the fallback fails, and the pending
    requestor is cancelled.


RQ.race(requestors [, milliseconds])

    RQ.race returns a requestor that starts all of the functions in the
    requestors array in parallel. Its result is the result of the first of
    those requestors to successfully finish (all of the other requestors are
    cancelled). If all of those requestors fail, then the race fails.

    If the optional milliseconds argument is supplied, then if no requestor has
    been successful in the allotted time, then the race fails, and all pending
    requestors are cancelled.


RQ.parallel(requireds [, milliseconds])
RQ.parallel(requireds [, milliseconds], optionals [,untilliseconds])

    RQ.parallel returns a requestor that processes many requestors in parallel,
    producing an array of all of the successful results. It can take two arrays
    of requests: Those that are required to produce results, and those that may
    optionally produce results. Each of the optional requestors has until all
    of the required requestors have finished, or until the optional
    untilliseconds timer has expired.

    The result maps the required requestors and optional requestors into a
    single array. The value produced by the first element of the requestors array provides the
    first element of the result.

    If the optional milliseconds argument is supplied, then if all of the
    required requestors are not successful in the allotted time, then the
    parallel fails. If the requireds array is empty, and if at least one
    optional requestor is successful within the allotted time, then the
    parallel succeeds.


RQ.sequence(requestors [, milliseconds])

    RQ.sequence returns a requestor that processes each element of the
    requestors array one at a time. Each will be passed the result of the
    previous. If all succeed, then the sequence succeeds, having the result of
    the last of the requestors. If any fail, then the sequence fails.

    If the optional milliseconds argument is supplied, then if all of the
    requestors have not all completed in the allotted time, then the sequence
    fails and the pending requestor is cancelled.
*/

/*global
    clearTimeout, setImmediate, setTimeout
*/

/*properties
    array, evidence, fallback, freeze, forEach, index, isArray, length,
    message, method, milliseconds, name, parallel, race, sequence, value
*/

module.exports = (function () {
    'use strict';

    function expired(method, milliseconds) {

// Make an expired exception.

        return {
            name: "expired",
            method: method,
            message: "expired after " + milliseconds,
            milliseconds: milliseconds
        };
    }

    function check(method, requestors, milliseconds, optionals, untilliseconds) {

// Verify that the arguments are typed properly.        

// requestors must be an array of functions, and it may be empty only if
// optionals is present.

        if (optionals === undefined) {
            if (!Array.isArray(requestors) || requestors.length === 0) {
                throw new TypeError(method + " requestors");
            }
        } else {
            check("RQ.parallel optionals", optionals, untilliseconds);
            if (requestors && !Array.isArray(requestors)) {
                throw new TypeError(method + " requestors");
            }
        }
        requestors.forEach(function (value, index) {
            if (typeof value !== 'function') {
                var e = new TypeError("not a function");
                e.array = requestors;
                e.index = index;
                e.method = method;
                e.value = value;
                throw e;
            }
        });
        if (
            milliseconds &&
            (typeof milliseconds !== 'number' || milliseconds < 0)
        ) {
            throw new TypeError(method + " milliseconds");
        }
    }

    function check_callback(method, callback, initial) {
        if (typeof callback !== 'function') {
            throw new TypeError(method + " callback");
        }
        if (initial !== null && typeof initial === 'object') {
            Object.freeze(initial);
        }
    }

    return {
        fallback: function fallback(requestors, milliseconds) {

// RQ.fallback takes an array of requestor functions, and returns a requestor
// that will call them each in order until it finds a successful outcome.

// If all of the requestor functions fail, then the fallback fails. If the time
// expires, then work in progress is cancelled.

            check("RQ.fallback", requestors, milliseconds);
            return function requestor(callback, initial) {
                var cancellation,
                    timeout_id;

                function finish(success, failure) {
                    var r = callback;
                    cancellation = null;
                    if (r) {
                        if (timeout_id) {
                            clearTimeout(timeout_id);
                        }
                        callback = null;
                        timeout_id = null;
                        return r(success, failure);
                    }
                }

                function cancel(reason) {
                    if (callback && typeof cancellation === 'function') {
                        setImmediate(cancellation, reason);
                    }
                    return finish(undefined, reason || true);
                }

                check_callback("RQ.fallback", callback, initial);
                if (milliseconds) {
                    timeout_id = setTimeout(function () {
                        return cancel(expired("RQ.fallback", milliseconds));
                    }, milliseconds);
                }
                (function next(index, failure) {
                    if (typeof callback === 'function') {

// If there are no more requestors, then signal failure.

                        if (index >= requestors.length) {
                            clearTimeout(timeout_id);
                            cancellation = null;
                            return cancel(failure);
                        }

// If there is another requestor, call it in the next turn, passing the value
// and a callback that will take the next step.

                        var rqstr = requestors[index];
                        setImmediate(function () {
                            var once = true;
                            if (typeof callback === 'function') {
                                cancellation = rqstr(
                                    function callback(success, failure) {
                                        if (once) {
                                            once = false;
                                            cancellation = null;
                                            return failure === undefined
                                            ? finish(success)
                                            : next(index + 1, failure);
                                        }
                                    },
                                    initial
                                );
                            }
                        });
                    }
                }(0));
                return cancel;
            };
        },
        parallel: function parallel(
            requireds,
            milliseconds,
            optionals,
            untilliseconds
        ) {

// RQ.parallel takes an array of required requestors, and an optional array of
// optional requestors, and starts them all. It succeeds if all of the required
// requestors finish successfully before the time expires. The result is an
// array collecting the results of all of the requestors.

// If there is no milliseconds argument, then shift the other arguments.

            if (typeof milliseconds !== 'number') {
                untilliseconds = optionals;
                optionals = milliseconds;
                milliseconds = undefined;
            }
            check("RQ.parallel", requireds, milliseconds, optionals,
                    untilliseconds);

            return function requestor(callback, initial) {
                var cancels = [],
                    optionals_remaining,
                    optionals_successes = 0,
                    requireds_length = requireds.length,
                    requireds_remaining = requireds.length,
                    results = [],
                    timeout_until,
                    timeout_id;

                function finish(success, failure) {
                    var r = callback;
                    if (r) {
                        callback = null;
                        if (timeout_id) {
                            clearTimeout(timeout_id);
                            timeout_id = null;
                        }
                        if (timeout_until) {
                            clearTimeout(timeout_until);
                            timeout_until = null;
                        }
                        cancels.forEach(function (cancel) {
                            if (typeof cancel === 'function') {
                                return setImmediate(cancel, failure);
                            }
                        });
                        cancels = null;
                        results = null;
                        return r(success, failure);
                    }
                }

                function cancel(reason) {
                    return finish(undefined, reason || true);
                }

                check_callback("RQ.parallel", callback, initial);

// milliseconds, if specified, says take no longer to process this request. If
// any of the required requestors are not successful by this time, the parallel
// requestor fails.

                if (milliseconds) {
                    timeout_id = setTimeout(function () {
                        timeout_id = null;
                        return requireds_remaining === 0 && (
                            requireds_length > 0 || optionals_successes > 0
                        )
                        ? finish(results)
                        : cancel(expired("RQ.parallel", milliseconds));
                    }, milliseconds);
                }

// Normally, the optional requestors have until all of the required requestors
// finish. If untilliseconds was specified, more time is given for the optional
// requestors to complete. If untilliseconds is larger than milliseconds,
// milliseconds wins.

                if (untilliseconds) {
                    timeout_until = setTimeout(function () {
                        timeout_until = null;
                        if (requireds_remaining === 0) {
                            return finish(results);
                        }
                    }, untilliseconds);
                }
                if (requireds) {
                    requireds.forEach(function (requestor, index) {
                        return setImmediate(function () {
                            var once = true,
                                cancellation = requestor(
                                    function callback(success, failure) {
                                        if (once && cancels) {
                                            once = false;
                                            cancels[index] = null;
                                            if (failure !== undefined) {
                                                return cancel(failure);
                                            }
                                            results[index] = success;
                                            requireds_remaining -= 1;
                                            if (
                                                requireds_remaining === 0 &&
                                                !timeout_until
                                            ) {
                                                return finish(results);
                                            }
                                        }
                                    },
                                    initial
                                );
                            if (cancels && cancels[index] === undefined) {
                                cancels[index] = cancellation;
                            }
                        });
                    });
                }
                if (optionals) {
                    optionals_remaining = optionals.length;
                    optionals.forEach(function (requestor, index) {
                        return setImmediate(function () {
                            var once = true,
                                cancellation = requestor(
                                    function callback(success, failure) {
                                        if (once && cancels) {
                                            once = false;
                                            cancels[
                                                requireds_length + index
                                            ] = null;
                                            if (failure === undefined) {
                                                results[
                                                    requireds_length + index
                                                ] = success;
                                                optionals_successes += 1;
                                            }
                                            optionals_remaining -= 1;
                                            if (optionals_remaining === 0) {
                                                if (requireds_remaining === 0) {
                                                    return requireds_length > 0 ||
                                                            optionals_successes > 0
                                                    ? finish(results)
                                                    : cancel(failure);
                                                }
                                                if (timeout_until) {
                                                    clearTimeout(timeout_until);
                                                    timeout_until = null;
                                                }
                                            }
                                        }
                                    },
                                    initial
                                );
                            if (cancels[requireds_length + index] ===
                                    undefined) {
                                cancels[requireds_length + index] = cancellation;
                            }
                        });
                    });
                }
                return cancel;
            };
        },
        race: function race(requestors, milliseconds) {

// RQ.race takes an array of requestor functions. It starts them all
// immediately. The first to finish wins. A race is successful if any
// contestant is successful. It fails if all requestors fail or if the time
// expires.

            check("RQ.race", requestors, milliseconds);
            return function requestor(callback, initial) {
                var cancels = [],
                    remaining = requestors.length,
                    timeout_id;

                function finish(success, failure) {
                    var r = callback;
                    if (r) {
                        callback = null;
                        if (timeout_id) {
                            clearTimeout(timeout_id);
                        }
                        cancels.forEach(function stop(cancel) {
                            if (typeof cancel === 'function') {
                                return setImmediate(cancel);
                            }
                        });
                        cancels = null;
                        return r(success, failure);
                    }
                }

                function cancel(reason) {
                    return finish(undefined, reason || true);
                }

                check_callback("RQ.race", callback, initial);
                if (milliseconds) {
                    timeout_id = setTimeout(function timeout_id() {
                        return cancel(expired("RQ.race", milliseconds));
                    }, milliseconds);
                }
                requestors.forEach(function (requestor, index) {
                    return setImmediate(function () {
                        var once = true,
                            cancellation = requestor(
                                function callback(success, failure) {
                                    if (once && cancels) {
                                        once = false;
                                        cancels[index] = null;
                                        if (failure === undefined) {
                                            return finish(success);
                                        }
                                        remaining -= 1;
                                        if (remaining === 0) {
                                            return cancel(failure);
                                        }
                                    }
                                },
                                initial
                            );
                        if (cancels[index] === undefined) {
                            cancels[index] = cancellation;
                        }
                    });
                });
                return cancel;
            };
        },
        sequence: function sequence(requestors, milliseconds) {

// RQ.sequence takes an array of requestor functions, and returns a requestor
// that will call them each in order. An initial value is passed to each, which
// is the previous success result.

// If any of the requestor functions fail, then the whole sequence fails, and
// the remaining requestors are not called.

            check("RQ.sequence", requestors, milliseconds);
            return function requestor(callback, initial) {
                var cancellation,
                    timeout_id;

                function finish(success, failure) {
                    var r = callback;
                    cancellation = null;
                    if (r) {
                        if (timeout_id) {
                            clearTimeout(timeout_id);
                        }
                        callback = null;
                        return r(success, failure);
                    }
                }

                function cancel(reason) {
                    if (callback && typeof cancellation === 'function') {
                        setImmediate(cancellation, reason);
                    }
                    return finish(undefined, reason || true);
                }

                check_callback("RQ.sequence", callback, initial);
                if (milliseconds) {
                    timeout_id = setTimeout(function () {
                        timeout_id = null;
                        return cancel(expired("RQ.sequence", milliseconds));
                    }, milliseconds);
                }
                (function next(index) {
                    var rqstr, r = callback;
                    if (typeof r === 'function') {

// If there are no more requestors, then signal success.

                        if (index >= requestors.length) {
                            if (timeout_id) {
                                clearTimeout(timeout_id);
                            }
                            callback = null;
                            cancellation = null;
                            return r(initial);
                        }

// If there is another requestor, call it in the next turn, passing the value
// and a callback that will take the next step.

                        rqstr = requestors[index];
                        setImmediate(function () {
                            var once = true;
                            cancellation = rqstr(
                                function callback(success, failure) {
                                    if (once) {
                                        once = false;
                                        cancellation = null;
                                        if (failure !== undefined) {
                                            return cancel(failure);
                                        }
                                        initial = success;
                                        return next(index + 1);
                                    }
                                },
                                initial
                            );
                        });
                    }
                }(0));
                return cancel;
            };
        }
    };
}());
