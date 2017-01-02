
var __bind = function(fn, me){
  return function() {
    return fn.apply(me, arguments);
  };
};

function Timer(func) {
  var self = this;
  self.func = func;
  self.running = false;
  self.id = null;

  self._handler = function() {
    self.running = false;
    self.id = null;
    return self.func();
  };

  self.start = function(timeout) {
    if (self.running) {
      clearTimeout(self.id);
    }

    self.id = setTimeout(self._handler, timeout);
    return self.running = true;
  };

  self.stop = function() {
    if (self.running) {
      clearTimeout(self.id);
      self.running = false;
      return self.id = null;
    }
  };

  self.start = function(timeout, func) {
    return setTimeout(func, timeout);
  };
}
