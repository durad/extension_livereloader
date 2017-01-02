'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var PROTOCOL_6 = 'http://livereload.com/protocols/official-6';
var PROTOCOL_7 = 'http://livereload.com/protocols/official-7';
var VERSION = '2.0.8';

var Timer = (function () {
  function Timer(func) {
    _classCallCheck(this, Timer);

    this.func = func || function () {};
    this.id = null;
  }

  _createClass(Timer, [{
    key: 'start',
    value: function start(timeout) {
      var _this = this;

      if (this.id) {
        clearTimeout(this.id);
      }

      this.id = setTimeout(function () {
        _this.id = null;
        _this.func();
      }, timeout);
    }
  }, {
    key: 'stop',
    value: function stop() {
      if (this.id) {
        clearTimeout(this.id);
        return this.id = null;
      }
    }
  }]);

  return Timer;
})();

var ProtocolError = function ProtocolError(reason, data) {
  _classCallCheck(this, ProtocolError);

  this.message = 'LiveReload protocol error (' + reason + ') after receiving data: "' + data + '".';
};

var Parser = (function () {
  function Parser(handlers) {
    _classCallCheck(this, Parser);

    this.handlers = handlers;
    this.reset();
  }

  _createClass(Parser, [{
    key: 'reset',
    value: function reset() {
      return this.protocol = null;
    }
  }, {
    key: 'process',
    value: function process(data) {
      var command, message, options, _ref, _ref2;
      try {
        if (!(this.protocol != null)) {
          if (data.match(/^!!ver:([\d.]+)$/)) {
            this.protocol = 6;
          } else if (message = this._parseMessage(data, ['hello'])) {
            if (!message.protocols.length) {
              throw new ProtocolError("no protocols specified in handshake message");
            } else if (__indexOf.call(message.protocols, PROTOCOL_7) >= 0) {
              this.protocol = 7;
            } else if (__indexOf.call(message.protocols, PROTOCOL_6) >= 0) {
              this.protocol = 6;
            } else {
              throw new ProtocolError("no supported protocols found");
            }
          }
          return this.handlers.connected(this.protocol);
        } else if (this.protocol === 6) {
          message = JSON.parse(data);
          if (!message.length) {
            throw new ProtocolError("protocol 6 messages must be arrays");
          }
          command = message[0], options = message[1];
          if (command !== 'refresh') {
            throw new ProtocolError("unknown protocol 6 command");
          }
          return this.handlers.message({
            command: 'reload',
            path: options.path,
            liveCSS: (_ref = options.apply_css_live) != null ? _ref : true,
            liveImg: (_ref2 = options.apply_img_live) != null ? _ref2 : true,
            originalPath: options.original_path,
            overrideURL: options.override_url
          });
        } else {
          message = this._parseMessage(data, ['reload', 'alert']);
          return this.handlers.message(message);
        }
      } catch (e) {
        if (e instanceof ProtocolError) {
          return this.handlers.error(e);
        } else {
          throw e;
        }
      }
    }
  }, {
    key: '_parseMessage',
    value: function _parseMessage(data, validCommands) {
      var message, _ref;
      try {
        message = JSON.parse(data);
      } catch (e) {
        throw new ProtocolError('unparsable JSON', data);
      }

      if (!message.command) {
        throw new ProtocolError('missing "command" key', data);
      }

      if ((_ref = message.command, __indexOf.call(validCommands, _ref) < 0)) {
        throw new ProtocolError("invalid command '" + message.command + "', only valid commands are: " + validCommands.join(', ') + ")", data);
      }

      return message;
    }
  }]);

  return Parser;
})();

var Connector = (function () {
  function Connector(options, WebSocket, handlers) {
    var _this2 = this;

    _classCallCheck(this, Connector);

    this.options = options;
    this.WebSocket = WebSocket;

    this.handlers = handlers;
    this.lastHandler = null;

    this.uri = null;
    this._nextDelay = this.options.mindelay;
    this._connectionDesired = false;
    this.protocol = 0;

    this.protocolParser = new Parser({
      connected: function connected(protocol) {
        _this2.protocol = protocol;
        _this2._handshakeTimeout.stop();
        _this2._nextDelay = _this2.options.mindelay;
        _this2._disconnectionReason = 'broken';
        _this2.callHandler('connected', protocol);
      },
      error: function error(e) {
        _this2.callHandler('error', e);
        _this2._closeOnError();
      },
      message: function message(_message) {
        _this2.callHandler('message', _message);
      }
    });

    this._handshakeTimeout = new Timer(function () {
      if (!_this2._isSocketConnected()) {
        return;
      }

      _this2._disconnectionReason = 'handshake-timeout';
      _this2.socket.close();
    });

    this._reconnectTimer = new Timer(function () {
      if (!_this2._connectionDesired) {
        return;
      }

      _this2.connect();
    });
  }

  _createClass(Connector, [{
    key: 'callHandler',
    value: function callHandler(handlerName) {
      if (this.handlers && this.handlers[handlerName] && (handlerName != this.lastHandler || handlerName == 'message')) {
        for (var _len = arguments.length, params = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          params[_key - 1] = arguments[_key];
        }

        this.handlers[handlerName](params);
        this.lastHandler = handlerName;
      }
    }
  }, {
    key: '_isSocketConnected',
    value: function _isSocketConnected() {
      return this.socket && this.socket.readyState === this.WebSocket.OPEN;
    }
  }, {
    key: 'connect',
    value: function connect() {
      var _this3 = this;

      this._connectionDesired = true;
      if (this._isSocketConnected()) {
        return;
      }

      this._reconnectTimer.stop();
      this._disconnectionReason = 'cannot-connect';
      this.protocolParser.reset();
      this.callHandler('connecting');

      this.socket = new this.WebSocket(this.uri);
      this.socket.onopen = function (e) {
        return _this3._onopen(e);
      };
      this.socket.onclose = function (e) {
        return _this3._onclose(e);
      };
      this.socket.onmessage = function (e) {
        return _this3._onmessage(e);
      };
      this.socket.onerror = function (e) {
        return _this3._onerror(e);
      };
    }
  }, {
    key: 'disconnect',
    value: function disconnect() {
      this._connectionDesired = false;
      this._reconnectTimer.stop();
      if (!this._isSocketConnected()) {
        return;
      }

      this._disconnectionReason = 'manual';
      this.socket.close();
    }
  }, {
    key: '_scheduleReconnection',
    value: function _scheduleReconnection() {
      if (!this._connectionDesired) {
        return;
      }

      if (!this._reconnectTimer.running) {
        this._reconnectTimer.start(this._nextDelay);
        this._nextDelay = Math.min(this.options.maxdelay, this._nextDelay * 2);
      }
    }
  }, {
    key: 'sendCommand',
    value: function sendCommand(command) {
      if (this.protocol == null) {
        return;
      }

      this._sendCommand(command);
    }
  }, {
    key: '_sendCommand',
    value: function _sendCommand(command) {
      this.socket.send(JSON.stringify(command));
    }
  }, {
    key: '_closeOnError',
    value: function _closeOnError() {
      this._handshakeTimeout.stop();
      this._disconnectionReason = 'error';
      this.socket.close();
    }
  }, {
    key: '_onopen',
    value: function _onopen(e) {
      var hello;
      this.callHandler('socketConnected');
      this._disconnectionReason = 'handshake-failed';

      hello = {
        command: 'hello',
        protocols: [PROTOCOL_6, PROTOCOL_7],
        ver: VERSION
      };

      if (this.options.ext) {
        hello.ext = this.options.ext;
      }

      if (this.options.extver) {
        hello.extver = this.options.extver;
      }

      if (this.options.snipver) {
        hello.snipver = this.options.snipver;
      }

      this._sendCommand(hello);
      this._handshakeTimeout.start(this.options.handshake_timeout);
    }
  }, {
    key: '_onclose',
    value: function _onclose(e) {
      this.protocol = 0;
      this.callHandler('disconnected', this._disconnectionReason, this._nextDelay);
      return this._scheduleReconnection();
    }
  }, {
    key: '_onerror',
    value: function _onerror(e) {}
  }, {
    key: '_onmessage',
    value: function _onmessage(e) {
      return this.protocolParser.process(e.data);
    }
  }]);

  return Connector;
})();
