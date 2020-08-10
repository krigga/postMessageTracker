function saveOptions() {
	const logUrl = document.getElementById("logurl").value;
	chrome.storage.sync.set({
		logUrl: logUrl.trim()
	}, function () {
		const status = document.getElementById("status");
		status.textContent = "Options saved.";
		setTimeout(function () {
			status.textContent = "";
			window.close();
		}, 750);
	});
}

function restoreOptions() {
	chrome.storage.sync.get({
		logUrl: ""
	}, function(items) {
		document.getElementById("logurl").value = items.logUrl;
	});
}

document.addEventListener("DOMContentLoaded", function () {
	restoreOptions();
	document.getElementById("save").addEventListener("click", saveOptions);
});
