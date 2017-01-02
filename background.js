
var isConnected = false;
var urlType = 'ws';
var url = 'localhost:35729';
var extensionId = null;
var isReloadingTab = false;
var tabId = null;
var logLines = [];
var manualDisconnect = false;

var state = 'disconnected'; // disconnected, connecting, connected
var connector = new Connector({ mindelay: 1000, maxdelay: 2000, handshake_timeout: 5000 }, window.WebSocket,
	{
		connected: function() { changeState('connected'); },
		disconnected: function() { changeState(manualDisconnect ? 'disconnected' : 'connecting'); },
		message: onMessage
	});

function getDevExtensions(cb) {
	chrome.management.getAll(function(extensions) {
		cb(null, _.chain(extensions)
			.where({ installType: 'development', enabled: true })
			.map(function(e) { return _.pick(e, 'id', 'name'); })
			.value());
	});
}

function getAllTabs(cb) {
	chrome.windows.getAll({ populate: true }, function(windows) {
		cb(null, _.chain(windows)
			.map(function(w) { return w.tabs; })
			.flatten(true)
			.map(function(t) { return _.pick(t, 'id', 'title'); })
			.value());
	});
}

function eventName(state) {
	switch (state) {
		case 'disconnected': return 'Disconnected';
		case 'connecting': return 'Connecting...';
		case 'connected': return 'Connected to ' + urlType + '://' + url;
	}
}

function changeState(newState) {
	if (state == newState) return;

	state = newState;

	var stateText = eventName(state);
	var line = { text: stateText, time: Date.now() };
	logLines.push(line);

	var request = {
		type: 'changeState',
		state: state,
		stateText: stateText,
		log: line
	};

	chrome.runtime.sendMessage(request, function(response) {});
};

function onMessage(messages) {
	if (!(messages instanceof Array)) return;

	var message = messages[0];
	if (message.command !== 'reload') return;

	var sendReloadMessage = function() {
		var request = {
			type: 'reload',
			log: { text: 'Reload', time: Date.now() }
		};

		chrome.runtime.sendMessage(request, function(response) {});
	};

	chrome.management.setEnabled(extensionId, false, function() {
		chrome.management.setEnabled(extensionId, true, function() {
			sendReloadMessage();

			if (isReloadingTab) {
				chrome.tabs.reload(tabId);
			}
		});

	});
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	switch (request.type) {
		case 'getInputs':
			getDevExtensions(function(err, extensions) {
				getAllTabs(function(err, tabs) {
					var response = {
						urlType: urlType,
						url: url,
						extensions: extensions,
						extensionId: extensionId,
						tabs: tabs,
						isReloadingTab: isReloadingTab && _.any(tabs, { id: tabId }),
						tabId: tabId,
						currentState: state,
						currentStateText: eventName(state),
						logLines: logLines
					};

					sendResponse(response);
				});
			});

			return true;

		case 'connect':
			manualDisconnect = false;
			connector.disconnect();

			urlType = request.urlType;
			url = request.url;
			extensionId = request.extensionId;
			isReloadingTab = request.isReloadingTab;
			tabId = request.tabId;

			changeState('connecting');
			connector.uri = urlType + '://' + url;
			connector.connect();
			break;

		case 'disconnect':
			manualDisconnect = true;
			connector.disconnect();
			break;
	}
});
