function Connector(options, WebSocket, Timer, handlers) {
  var _this = this;
  var webSocketProtocol;
  this.options = options;
  this.WebSocket = WebSocket;
  this.Timer = Timer;
  this.handlers = handlers;
  webSocketProtocol = document.location.protocol === "https:" ? "wss:" : "ws:";
  this._uri = "" + webSocketProtocol + "//" + this.options.host + ":" + this.options.port + "/livereload";
  this._uri = serverUri;
  this._nextDelay = this.options.mindelay;
  this._connectionDesired = false;
  this.protocol = 0;
  this.protocolParser = new Parser({
    connected: function(protocol) {
      _this.protocol = protocol;
      _this._handshakeTimeout.stop();
      _this._nextDelay = _this.options.mindelay;
      _this._disconnectionReason = 'broken';
      return _this.handlers.connected(protocol);
    },
    error: function(e) {
      _this.handlers.error(e);
      return _this._closeOnError();
    },
    message: function(message) {
      return _this.handlers.message(message);
    }
  });
  this._handshakeTimeout = new Timer(function() {
    if (!_this._isSocketConnected()) {
      return;
    }
    _this._disconnectionReason = 'handshake-timeout';
    return _this.socket.close();
  });
  this._reconnectTimer = new Timer(function() {
    if (!_this._connectionDesired) {
      return;
    }
    return _this.connect();
  });
  this.connect();
}

Connector.prototype._isSocketConnected = function() {
  return this.socket && this.socket.readyState === this.WebSocket.OPEN;
};

Connector.prototype.connect = function() {
  var _this = this;
  this._connectionDesired = true;
  if (this._isSocketConnected()) {
    return;
  }
  this._reconnectTimer.stop();
  this._disconnectionReason = 'cannot-connect';
  this.protocolParser.reset();
  this.handlers.connecting();
  this.socket = new this.WebSocket(this._uri);
  this.socket.onopen = function(e) {
    return _this._onopen(e);
  };
  this.socket.onclose = function(e) {
    return _this._onclose(e);
  };
  this.socket.onmessage = function(e) {
    return _this._onmessage(e);
  };
  return this.socket.onerror = function(e) {
    return _this._onerror(e);
  };
};

Connector.prototype.disconnect = function() {
  this._connectionDesired = false;
  this._reconnectTimer.stop();
  if (!this._isSocketConnected()) {
    return;
  }
  this._disconnectionReason = 'manual';
  return this.socket.close();
};

Connector.prototype._scheduleReconnection = function() {
  if (!this._connectionDesired) {
    return;
  }
  if (!this._reconnectTimer.running) {
    this._reconnectTimer.start(this._nextDelay);
    return this._nextDelay = Math.min(this.options.maxdelay, this._nextDelay * 2);
  }
};

Connector.prototype.sendCommand = function(command) {
  if (this.protocol == null) {
    return;
  }
  return this._sendCommand(command);
};

Connector.prototype._sendCommand = function(command) {
  return this.socket.send(JSON.stringify(command));
};

Connector.prototype._closeOnError = function() {
  this._handshakeTimeout.stop();
  this._disconnectionReason = 'error';
  return this.socket.close();
};

Connector.prototype._onopen = function(e) {
  var hello;
  this.handlers.socketConnected();
  this._disconnectionReason = 'handshake-failed';
  hello = {
    command: 'hello',
    protocols: [PROTOCOL_6, PROTOCOL_7]
  };
  hello.ver = Version;
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
  return this._handshakeTimeout.start(this.options.handshake_timeout);
};

Connector.prototype._onclose = function(e) {
  this.protocol = 0;
  this.handlers.disconnected(this._disconnectionReason, this._nextDelay);
  return this._scheduleReconnection();
};

Connector.prototype._onerror = function(e) {};

Connector.prototype._onmessage = function(e) {
  return this.protocolParser.process(e.data);
};
