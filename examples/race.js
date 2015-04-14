var RQ = require('RQ');

function timer(i, delay) {
  return function requestor(callback, value) {
    setTimeout(function() {
      callback(i);
    }, delay);
  };
}

var racer = RQ.race([
  timer(1, 1000),
  timer(2, 500),
  timer(3, 520),
]);

racer(function(success, failure) {
  console.log(success);
});
