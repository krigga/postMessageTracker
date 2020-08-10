/*
History is needed to hijack pushState-changes
addEventListener to hijack the message-handlers getting registered
defineSetter to handle old way of setting onmessage
beforeunload to track page changes (since we see no diff btw fragmentchange/pushState and real location change

we also look for event.dispatch.apply in the listener, if it exists, we find a earlier stack-row and use that one
also, we look for jQuery-expandos to identify events being added later on by jQuery"s dispatcher
*/ 
let injectedJS = function(pushState, addEventListener) {
	let loaded = false;
	const m = function (detail) {
		var storeEvent = new CustomEvent("postMessageTracker", { detail });
		document.dispatchEvent(storeEvent);
	};
	const h = function (p) {
		let hops = "";
        try {
        		if (!p) p = window;
        		if (p.top != p && p.top == window.top) {
        			let w = p;
        			while (top != w) { 
        				let x = 0;
        				for (var i = 0; i < w.parent.frames.length; i++) { 
        					if (w == w.parent.frames[i]) x = i;
        				}
        				hops = "frames["+x+"]" + (hops.length ? "." : "") + hops; 
        				w = w.parent;
        			}; 
        			hops = "top" + (hops.length ? "." + hops : "");
        		} else {
        			hops = p.top == window.top ? "top" : "diffwin";
        		}
        } catch(e) { }
		return hops;
	};
	const jq = function (instance) {
		if (!instance || !instance.message || !instance.message.length) return;
        let j = 0;
        let e = null;
        while (e = instance.message[j++]) {
            if (!e.handler) return;
			m({ window: window.top == window ? "top" : window.name, hops: h(), domain: document.domain, stack: "jQuery", listener:e.handler.toString() });
		};
	};
	const l = function (listener, patternBefore, additionalOffset) {
        const offset = 3 + (additionalOffset || 0);
        let stack = null;
		try { throw new Error(""); } catch (error) { stack = error.stack || ""; }
		stack = stack.split("\n").map(function (line) { return line.trim(); });
		const fullStack = stack.slice();
		if (patternBefore) {
			let nextItem = false;
			stack = stack.filter(function(e){
				if (nextItem) { 
                    nextItem = false;
                    return true;
                }
				if (e.match(patternBefore)) nextItem = true;
				return false;
			});
			stack = stack[0];
		} else {
			stack = stack[offset];
		}
		const listenerStr = listener.__postmessagetrackername__ || listener.toString();
		m({ window: window.top == window ? "top" : window.name, hops: h(), domain: document.domain, stack, fullStack, listener: listenerStr });
	};
	const jqc = function (key) {
		m({ log: ["Found key", key, typeof window[key], window[key] ? window[key].toString() : window[key]] });
		if (typeof window[key] == "function" && typeof window[key]._data == "function") {
			m({ log: ["found jq function", window[key].toString()] });
			const ev = window[key]._data(window, "events");
			jq(ev);
		} else if (window[key] && (expando = window[key].expando)) {
			m({ log: ["Use expando", expando] });
            let i = 1;
            let instance = null;
            while (instance = window[expando + i++]) {
				jq(instance.events);
			}
		} else if (window[key]) {
			m({ log: ["Use events directly", window[key].toString()] });
			jq(window[key].events);
		}
	};
	const j = function() {
		m({ log: "Run jquery fetcher" });
		const all = Object.getOwnPropertyNames(window);
		const len = all.length;
		for (let i = 0; i < len; i++) {
			const key = all[i];
			if(key.indexOf("jQuery") !== -1) {
				jqc(key);
			}
		}
		loaded = true;
    };
    
	History.prototype.pushState = function() {
		m({ pushState: true });
		return pushState.apply(this, arguments);
    };
    
	const originalSetter = window.__lookupSetter__("onmessage");
	window.__defineSetter__("onmessage", function(listener) {
		if (listener) {
			l(listener.toString());
		}
		originalSetter(listener);
    });
    
	const c = function (listener) {
		const listenerStr = listener.toString();
		if (listenerStr.match(/\.deep.*apply.*captureException/s)) return "raven";
		else if (listenerStr.match(/arguments.*(start|typeof).*err.*finally.*end/s) && listener["nr@original"] && typeof listener["nr@original"] == "function") return "newrelic";
		else if (listenerStr.match(/rollbarContext.*rollbarWrappedError/s) && listener._isWrap && 
					(typeof listener._wrapped == "function" || typeof listener._rollbar_wrapped == "function")) return "rollbar";
		else if (listenerStr.match(/autoNotify.*(unhandledException|notifyException)/s) && typeof listener.bugsnag == "function") return "bugsnag";
		return false;
	};

	window.addEventListener("message", function (e) {
        m({ logMessage: "%c" + h(e.source) + "%c→%c" + h() + " %c" + (typeof e.data == "string" ? e.data : "j " + JSON.stringify(e.data)) });
    });

	Window.prototype.addEventListener = function(type, listener) {
		if (type == "message") {
			let patternBefore = false, offset = 0;
			if (listener.toString().indexOf("event.dispatch.apply") !== -1) {
				m({ log:"We got a jquery dispatcher" });
				patternBefore = /init\.on|init\..*on\]/;
				if (loaded) { setTimeout(j, 100); }
			}
			const unwrap = function(listener) {
				const found = c(listener);
				if (found == "raven") {
					let fb = false, ff = false, v = null;
					for (let key in listener) {
						v = listener[key];
						if (typeof v == "function") { 
                            ff++; f = v;
                        } else if (typeof v == "boolean") fb++;
					}
					if (ff == 1 && fb == 1) {
						m({ log:"We got a raven wrapper" });
						offset++;
						listener = unwrap(f);
					}
				} else if (found == "newrelic") {
					m({ log: "We got a newrelic wrapper" });
					offset++;
					listener = unwrap(listener["nr@original"]);
				} else if(found == "rollbar") {
					m({ log: "We got a rollbar wrapper" });
					offset += 2;
				} else if (found == "bugsnag") {
					offset++;
					let clr = null;
					try { clr = arguments.callee.caller.caller.caller; } catch(e) { }
					if (clr && !c(clr)) { // ignore if its other wrappers
						m({ log: "We got a bugsnag wrapper" });
						listener.__postmessagetrackername__ = clr.toString();
					} else if (clr) offset++;
				}
				if (listener.name.indexOf("bound ") === 0) {
					listener.__postmessagetrackername__ = listener.name;
				}
				return listener;
			};
            if (typeof listener == "function") {
    			listener = unwrap(listener);
			    l(listener, patternBefore, offset);
            }
		}
		return addEventListener.apply(this, arguments);
	};
	window.addEventListener("load", j);
	window.addEventListener("postMessageTrackerUpdate", j);
};
injectedJS = "(" + injectedJS.toString() + ")(History.prototype.pushState, Window.prototype.addEventListener)";

let log = true;

document.addEventListener("postMessageTracker", function (event) {
    if (event.detail.logMessage && log) {
        console.log(event.detail.logMessage, "color: red", "", "color: green", "");
    } else {
        chrome.runtime.sendMessage(event.detail);
    }
});

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    switch (msg) {
		case "get-log":
			sendResponse(log);
			break;
        case "enable-logging":
            log = true;
            break;
        case "disable-logging":
            log = false;
            break;
    }
});

// we use this to separate fragment changes with location changes
window.addEventListener("beforeunload", function () {
	const storeEvent = new CustomEvent("postMessageTracker", { detail: { changePage: true } });
	document.dispatchEvent(storeEvent);
});

const script = document.createElement("script");
script.setAttribute("type", "text/javascript")
script.appendChild(document.createTextNode(injectedJS));
document.documentElement.appendChild(script);