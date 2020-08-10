const port = chrome.extension.connect({
	name: "postMessageTrackerPort"
});

window.onload = function () {
	const checkbox = document.getElementById("control");
	checkbox.addEventListener("change", function () {
        if (checkbox.checked) {
            port.postMessage("enable-logging");
        } else {
            port.postMessage("disable-logging");
        }
	});
	port.onMessage.addListener(function (msg) {
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			console.log(msg);
			if (msg.listeners) {
				const selectedId = tabs[0].id;
				showListeners(msg.listeners[selectedId]);
			} else if (msg.log !== undefined) {
				checkbox.checked = msg.log;
			}
		});
    });
	port.postMessage("get-log");
	port.postMessage("get-stuff");
};

function showListeners(listeners) {
	const list = document.getElementById("listeners");
	list.innerHTML = "";
	document.getElementById("url").innerText = listeners && listeners.length > 0 ? listeners[0].parentUrl : "";

	for (var i = 0; i < listeners.length; i++) {
		const listener = listeners[i];
		const el = document.createElement("li");

		const domain = document.createElement("b");
        domain.innerText = listener.domain;
        domain.style = "margin-right: 10px";
        el.appendChild(domain);

		const win = document.createElement("code");
		win.innerText = (listener.window ? listener.window + " " : "") + (listener.hops && listener.hops.length > 0 ? listener.hops : "");
		el.appendChild(win);

		const stack = document.createElement("span");
		if (listener.fullStack) stack.setAttribute("title", listener.fullStack.join("\n\n"));
		const stackText = document.createTextNode(listener.stack);
		
		stack.appendChild(stackText);
		el.appendChild(stack);

		const fun = document.createElement("pre");
		fun.innerText = listener.listener;
		el.appendChild(fun);

		list.appendChild(el);
	}
}