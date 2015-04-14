# RQ
> Better living through asynchronicity

This is a CommonJS-compatible port of this library for node.js/io.js.

The original source is available at: <https://github.com/douglascrockford/RQ>

## Introduction

Turn based servers are now joining turn based browsers in providing race-free
and deadlock-free interactivity. The event-driven model has long been popular
in UI systems, but the nature of work in servers presents some new challenges.
Functional programming provides solutions, including monads, arrows, promises,
and various flavors of FRP. This is another such solution, intended to enhance
ease of use for tasks which are common to server applications by providing
support of sequences, parallel operations, with timeouts and cancellations.

## Installation
```
$ npm install async-rq
```

## Usage
For complete documentation see [help.md](help.md).

```javascript
var RQ = require('RQ');
```

### `RQ.sequence()` example
```javascript
function widget(name, delay) {
  return function requestor(callback, value) {
    setTimeout(function() {
      if(!value) value = '(start)';
      callback(value + ' -> ' + name);
    }, delay);
  };
}

var runner = RQ.sequence([
  widget('Seq A1', 100),
  widget('Seq A2', 10),
  widget('Seq A3', 1),
  function(callback, value) {
    callback(value + ' -> (end)');
  }
]);

runner(function(success, failure) {
  console.log(success);
});
```

Result:
```
(start) -> Seq A1 -> Seq A2 -> Seq A3 -> (end)
```

### `RQ.race()` example

```javascript
function timer(i, delay) {
  return function requestor(callback, value) {
    setTimeout(function() {
      callback(i);
    }, delay);
  }
}

var racer = RQ.race([
  timer(1, 1000),
  timer(2, 500),
  timer(3, 520),
]);

racer(function(success, failure) {
  console.log(success);
});
```

Result will be:
```
2
```

## Author
Douglas Crockford ([@douglascrockford](https://github.com/douglascrockford))

## Licence
?
