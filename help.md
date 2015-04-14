RQ
==

Douglas Crockford\
 2015-04-13

**`RQ`** is a small JavaScript library for managing asychronicity in
server applications.

The source is available at <https://github.com/douglascrockford/RQ>.
This page is available at <http://www.RQ.crockford.com/>.

Asynchronicity
--------------

Asynchronicity is becoming the preferred method for solving a large
class of problems, from user interfaces to servers. Asychronous
functions return control to the caller almost immediately. Success or
failure will be communicated somehow in the future, but usually the
caller will resume long before that occurs. The communication will
probably make use of some sort of callback function or continuation.

Servers offer workflows that are signicantly different than those found
in user interfaces. An incoming message many require several processing
steps in which the result of each step is given to the next step. Since
each step may be concluded in a different processing turn, callbacks
must be used. The program may not simply block while awaiting results.
The naïve approach is start each step in the callback function to the
previous step. This is a very awkward way to write, producing programs
that are brittle, difficult to read, and difficult to maintain.

A workflow might have several independent steps, which means that those
steps could be taken in parallel, which could have significant
performance benefits. The elapsed time of the steps could be the slowest
of all of the steps, instead of the total of all of the steps, which
could be a dramatic speed up. But it is not obvious how to take
advantage of parallelism with simple callbacks. The naïve approach is to
preform each step serially. This is a very awkward way to write,
producing programs that a brittle, difficult to read, difficult to
maintain, and much too slow.

This pattern is so problematic that some of its users have denounced
asynchronicity, declaring that it is unnatural and impossible to manage.
But it turns out that the problem isn't with asyschronicity. The problem
is trying to do asynchronicity without proper tools. There are lots of
tools available now, including promises. There are many good things that
can be done with promises, but promises were not designed to help manage
workflows in servers.

That is specifically what `RQ` was designed to do. Asynchronicity is our
friend. We should not attempt to hide it or deny it. We must embrace
asynchronicity because it is our destiny. `RQ` gives you the simple
tools you need to do that.

Workflow
--------

With `RQ`, a workflow is broken into a set of steps or tasks or jobs.
Each step is represented by a function. These functions are called
*requestors* because calling one is likely to initiate a request. `RQ`
provides services that can collect some requestors together and process
them sequentially or in parallel.

For example, the `getNav` requestor will call the `getId` requestor,
give that result to the `getPreference` requestor, and give that result
to the `getCustomNav` requestor.

    getNav = RQ.sequence([
        getId,
        getPreference,
        getStuff,
        getCustomNav,
    ]);

The `getStuff` requestor that was used above will produce an array of
stuff, and it can get all of the stuff in parallel. It will begin the
`getNav`, `getAds`, `getWeather`, and `getMessageOfTheDay` jobs, and
also begin `getHoroscope` and `getGossip`. Those last two are considered
unimportant. If they can be finished before the four main jobs finish,
then they will be included in the result. But we won't wait for them.

    getStuff = RQ.parallel([
        getNav,
        getAds,
        getWeather,
        getMessageOfTheDay
    ], [
        getHoroscope,
        getGossip
    ]);

`RQ` can also support races, where several jobs are started at once and
the first one to finish successfully wins. We could have created the
`getAds` requestor that was used above like this:

    getAds = RQ.race([
        getAd(adnet.klikHaus),
        getAd(adnet.inUFace),
        getAd(adnet.trackPipe)
    ]);

`getAd` is a factory function that makes requestors. `getAds` takes a
parameter that identifies an advertising network. In this example,
requests will be made of of three advertising networks. The first to
provide an acceptable response will win.

`RQ` can also support fallbacks. If Plan A fails, try Plan B. And if
that fails, Plan C. The `getWeather` requestor that was used above could
have been made as a fallback. It would first try to get a result from
the local cache. If that fails, it will try the local database. If that
fails, it will try the remote database.

    getWeather = RQ.fallback([
        fetch("weather", localCache),
        fetch("weather", localDB),
        fetch("weather", remoteDB)
    ]);

`RQ` provides just four functions: `RQ.sequence`, `RQ.parallel`,
`RQ.race`, and `RQ.fallback`. Each takes an array of requestors and
returns a requestor that combines them into a unit. Each can also take
an optional timelimit which can cancel the jobs and produce an early
failure if time runs out.

The RQ Library
--------------

`RQ` is delivered as a single file,
[rq.js](https://github.com/douglascrockford/RQ). When run, it produces
an `RQ` variable containing an object containing four functions..

#### RQ.sequence(requestors)\
 RQ.sequence(requestors, milliseconds)

`RQ.sequence` takes an array of requestor functions and an optional time
limit in milliseconds. It returns a requestor function that will start
each of the requestors in order, giving the result of each to the next
one. If all complete successfully, the result will be the result of the
last requestor in the array. If any of the requestors in the array fail,
then the sequence fails. The array is not modified.

If a milliseconds argument is provided, then the sequence will fail if
it does not finish before the time limit.

#### RQ.parallel(requireds)\
 RQ.parallel(requireds, milliseconds)\
 RQ.parallel(requireds, optionals)\
 RQ.parallel(requireds, milliseconds, optionals)\
 RQ.parallel(requireds, optionals, untilliseconds)\
 RQ.parallel(requireds, milliseconds, optionals, untilliseconds)

`RQ.parallel` takes an array of required requestor functions, and an
optional time limit in milliseconds, and an optional array of optional
requestors and an optional guaranteed time for the optional requestors.
It returns a requestor function that will start all of the required and
optional requestors at once. The result is an array containing all of
the results from all of the requestors. If both arrays were provided,
the length of the results array is the sum of the lengths of the two
arrays. The result of the first requestor will be in the first position
of the results array. The parallel will succeed only if all of the
required requestors succeed. The array of optional requestors contains
requests that can fail without causing the entire parallel operation to
fail. It can be used as a best effort, obtaining the results that are
attainable. The arrays are not modified.

If a milliseconds argument is provided, then the parallel will fail if
all of the required requestors do not finish before the time limit. By
default, the optionals have until all of the required requestors finish.
The untilliseconds argument guarantees the optionals some amount of
time. untilliseconds may not be larger than milliseconds. If the
requireds array is empty, and if at least one optional requestor is
successful within the allotted time, then the parallel succeeds.

`RQ.parallel` does not add parallelism to JavaScript. It allows
JavaScript programs to effectively exploit the inherent parallelism of
the universe. It is likely that many of the requestors will be
communicating with other processes and other machines. Those other
processes and machines will be executing independently.

#### RQ.race(requestors)\
 RQ.race(requestors, milliseconds)

`RQ.race` takes an array of requestor functions and an optional time
limit in milliseconds. It returns a requestor function that will start
all of the requestors at once. The result is the first successful
result.. If all of the requestors in the array fail, then the race
fails. The array is not modified.

If a milliseconds argument is provided, then the race will fail if it
does not finish before the time limit.

#### RQ.fallback(requestors)\
 RQ.fallback(requestors, milliseconds)

`RQ.fallback` takes an array of requestor functions and an optional time
limit in milliseconds. It returns a requestor function try each of the
requestors in order until one is successful. If all of the requestors in
the array fail, then the sequence fails. The array is not modified.

If a milliseconds argument is provided, then the fallback will fail if
it does not finish before the time limit.

Function Types
--------------

`RQ` makes use of four types of functions: requestors, callbacks,
cancels, and factories.

### Requestor

A requestor is a function that represents some unit of work. It can be a
simple function, or it can be a complex job, task, or production step
that will organize the work of many machines over a long period of time.
A requestor function takes two arguments: A callback and an optional
value. The callback will be used by the requestor to communicate its
result. The optional value makes the result of a previous value in a
sequence to the requestor.

A requestor may optionally return a cancel function that can be used to
cancel the request.

### Callback

A callback is a function that is passed to a requestor so that the
requestor can communicate its result. A callback can take two arguments,
success and failure. If failure is `undefined`, then the requestor was
successful.

You only have to provide a callback when calling a requestor directly,
such as calling the result of `RQ.sequence` to start a multistep job.
The result of the job will be the first argument passed to your callback
function.

### Cancel

A cancel is a function that will attempt to stop the execution of a
requestor. A cancel function makes it possible to stop the processing of
a job that is no longer needed. For example, if several requestors are
started by `RQ.race` and if one of the requestors produces an successful
result, the results of the other requestors may be cancelled.
Cancellation is intended to stop unnecessary work. Cancellation does not
do rollbacks or undo.

A cancel function may optionally be returned by a requestor. If a
requestor sends a message to another process requesting work, the cancel
function should send a message to the same process indicating that the
work is no longer needed.

### Factory

A factory is a function that makes requestor functions. A factory will
usually take arguments that allow for the customization of the
requestor. The four functions provided by `RQ` (`RQ.sequence`,
`RQ.parallel`, `RQ.race`, `RQ.fallback`) are all factory functions.
Factory functions can simplify application development.

Timeouts
--------

Sometimes a correct result that takes too long is indistinguishable from
a failure. `RQ` provides optional timeout value that limit the amount of
time that a requestor is allowed to take. If a requestor takes too long
to do its work, it can be automatically cancelled. `RQ.fallback` makes
such failures recoverable.

Samples
-------

### Identity Requestor

The identity requestor receives a value and delivers that vallue to its
callback. If the identity requestor is placed in a sequence, it acts as
a nop, sending the result of the previous requestor to the next
requestor.

    function identity_requestor(callback, value) {
        return callback(value);
    }

### Fullname Requestor

The fullname requestor receives an object an delivers a string made from
components of the object.

    function fullname_requestor(callback, value) {
        return callback(value.firstname + ' ' + value.lastname);
    }

### Requestorize Factory

The requestorize factory can make a requestor from any function that
takes a single argument.

    function requestorize(func) {
        return function requestor(callback, value) {
            return callback(func(value));
        };
    }

We can use this to make processing steps in a sequence. For example, if
we have a function that takes an object and returns a fullname:

    function make_fullname(value) {
        return value.firstname + ' ' + value.lastname;
    }

We can turn it into a requestor that works just like the
`fullname_requestor`:

    var fullname_requestor = requestorize(fullname_requestor);

### Delay Requestor

The delay requestor inserts a delay into a sequence without blocking.

    function delay_requestor(callback, value) {
        var timeout_id = setTimeout(callback, 1000);
        return function cancel(reason) {
            return clearTimeout(timeout_id);
        };
    }

In a real requestor, instead of calling `setTimeout`, a message will be
transmitted to a process, and instead of calling `clearTimeout`, a
message will be transmitted to the same process to cancel the work.

### Delay Factory

The delay factory simplifies the making of delay requestors.

    function delay(milliseconds) {
        return function requestor(callback, value) {
            var timeout_id = setTimeout(callback, milliseconds);
            return function cancel(reason) {
                return clearTimeout(timeout_id);
            };
        };
    }
