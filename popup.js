
ko.bindingHandlers.scrollToBottom = {
	init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
		setTimeout(function() {
			element.scrollTop = element.scrollHeight;

			new MutationObserver(function(mutations) {
				$(element).animate({ scrollTop: element.scrollHeight }, 100);
			}).observe(element, { childList: true });
		}, 0);
	},
	update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
	}
};

function AppVm() {
	var self = this;

	self.urlType = ko.observable('');
	self.url = ko.observable('');
	self.extensions = ko.observableArray([]);
	self.extensionId = ko.observable(null);
	self.isReloadingTab = ko.observable(false);
	self.tabs = ko.observableArray([]);
	self.tabId = ko.observable(null);
	self.tabCaption = ko.observable('');
	self.currentState = ko.observable('disconnected');
	self.currentStateText = ko.observable('Disconnected');
	self.logLines = ko.observableArray([]);

	self.isShowingLog = ko.observable(false);

	self.isReloadingTab.subscribe(function() {
		if (!self.isReloadingTab()) {
			self.tabCaption('');
			self.tabId(null);
		} else {
			self.tabCaption(null);
		}
	});

	self.init = function() {
		var request = {
			type: 'getInputs',
			isReloadingTab: self.isReloadingTab(),
			tabId: self.tabId()
		};

		chrome.runtime.sendMessage(request, function(response) {
			self.urlType(response.urlType);
			self.url(response.url);
			self.extensions(response.extensions);
			self.extensionId(response.extensionId);
			self.tabs(response.tabs);
			self.isReloadingTab(response.isReloadingTab);
			self.tabId(response.tabId);
			self.currentState(response.currentState);
			self.currentStateText(response.currentStateText);
			self.logLines(response.logLines);
		});

		chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
			switch (request.type) {
				case 'changeState':
					self.currentState(request.state);
					self.currentStateText(request.stateText);
					self.logLines.push(request.log);
					break;
				case 'reload':
					self.logLines.push(request.log);
					break;
			}
		});
	};

	self.onConnectClicked = function() {
		var request = {
			type: 'connect',
			urlType: self.urlType(),
			url: self.url(),
			extensionId: self.extensionId(),
			isReloadingTab: self.isReloadingTab(),
			tabId: self.tabId()
		};

		chrome.runtime.sendMessage(request, function(response) {});
	};

	self.onDisconnectClicked = function() {
		chrome.runtime.sendMessage({ type: 'disconnect' }, function(response) {});
	};

	self.init();
}

$(document).ready(function() {
	var appVm = new AppVm();
	ko.applyBindings(appVm);
});



