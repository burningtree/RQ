var RQ = require('RQ');

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
