let tabListeners = {}, tabPush = {}, tabLastUrl = {}, selectedId = -1;

function refreshCount() {
	const count = tabListeners[selectedId] ? tabListeners[selectedId].length : 0;
	chrome.tabs.get(selectedId, function() {
		if (!chrome.runtime.lastError) {
			chrome.browserAction.setBadgeText({ text: count.toString(), tabId: selectedId });
			if (count > 0) {
				chrome.browserAction.setBadgeBackgroundColor({ color: [255, 0, 0, 255] });
			} else {
				chrome.browserAction.setBadgeBackgroundColor({ color: [0, 0, 255, 0] });
			}
		}
	});
}

function logListener(data) {
	chrome.storage.sync.get({
		logUrl: ""
	}, function(items) {
		const logUrl = items.logUrl.trim();
		if (logUrl.length === 0) return;
		try {
			fetch(logUrl, {
				method: "post",
				headers: {
					"Content-type": "application/json; charset=UTF-8"
				},
				body: JSON.stringify(data)
			});
		} catch(e) { }
	});
}

chrome.runtime.onMessage.addListener(function (msg, sender) {
	const tabId = sender.tab.id;
	if (msg.listener) {
		if (msg.listener == "function () { [native code] }") return;
		msg.parentUrl = sender.tab.url;
		if (!tabListeners[tabId]) tabListeners[tabId] = [];
		tabListeners[tabId].push(msg);
		logListener(msg);
	}
	if (msg.pushState) {
		tabPush[tabId] = true;
	}
	if (msg.changePage) {
		delete tabLastUrl[tabId];
	}
	if (msg.log) {
		console.log(msg.log);
	} else {
		refreshCount();
	}
});

chrome.tabs.onUpdated.addListener(function (tabId, props) {
	if (props.status == "complete") {
		if (tabId == selectedId) refreshCount();
	} else if (props.status) {
		if (tabPush[tabId]) {
			delete tabPush[tabId];
		} else if (!tabLastUrl[tabId]) {
			tabListeners[tabId] = [];
		}
	}
	if (props.status == "loading") tabLastUrl[tabId] = true;
});

chrome.tabs.onActivated.addListener(function(activeInfo) {
	selectedId = activeInfo.tabId;
	refreshCount();
});

chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
	selectedId = tabs[0].id;
	refreshCount();
});

chrome.extension.onConnect.addListener(function(port) {
	port.onMessage.addListener(function (msg) {
        switch (msg) {
            case "get-stuff":
                port.postMessage({ listeners: tabListeners });
				break;
			case "get-log":
				chrome.tabs.sendMessage(selectedId, msg, function (res) {
					port.postMessage({ log: res });
				});
				break;
            default:
                chrome.tabs.sendMessage(selectedId, msg);
        }
	});
})