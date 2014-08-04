const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/addons/XPIProvider.jsm');

const INSTALL_HANDLER = 0;
const UNINSTALL_HANDLER = 1;
const SET_HANDLER_ACTIVE = 2;
const SET_HANDLER_INACTIVE = 3;

const infoForWebmailHandlers = [
	{
		name: 'AIM Mail',
		uriTemplate: 'http://webmail.aol.com/Mail/ComposeMessage.aspx?to=%s',
		circleSelector: '.skills .css' //this is for me to target the proper row in the dom of the prefs frontend document.getElementById(circleId).parentNode.parentNode is the row element
	},
	{
		name: 'GMail',
		uriTemplate: 'https://mail.google.com/mail/?extsrc=mailto&url=%s',
		circleSelector: '.skills .ai'
	},
	{
		name: 'Outlook Live',
		uriTemplate: 'http://mail.live.com/secure/start?action=compose&to=%s',
		circleSelector: '.skills .ps'
	},
	{
		name: 'Y! Mail',
		uriTemplate: 'https://compose.mail.yahoo.com/?To=%s',
		circleSelector: '.skills .html'
	},
];

function init() {
	var actToggles = document.querySelectorAll('a.act-toggle');
	Array.prototype.forEach.call(actToggles, function(actTog) {
		actTog.addEventListener('click', toggleToActive, false);
	});
	var stalls = document.querySelectorAll('a.stall-me');
	Array.prototype.forEach.call(stalls, function(stall) {
		stall.addEventListener('click', toggleStall, false);
	});
	
	//start - determine active handler
	var eps = Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(Ci.nsIExternalProtocolService);
	var handlerInfo = eps.getProtocolHandlerInfo('mailto');


	//end - determine active handler
	
	//start - find installed handlers
	var uriTemplates_of_installedHandlers = [];
	var handlers = handlerInfo.possibleApplicationHandlers.enumerate();
	while (handlers.hasMoreElements()) {
		var handler = handlers.getNext().QueryInterface(Ci.nsIWebHandlerApp);
		uriTemplates_of_installedHandlers.push(handler.uriTemplate);
	}
	//end - find installed handlers

	/*
	//can do this way but im merging into the `mark installed handlers as installed....` block
	//start - determine if there is a preferred web app handler
	//note: handlerInfo.preferredAction can be stale. if handlerInfo.alwaysAskBeforeHandling is set to true, than the prerredAction can be internally or whatev its not true it will always ask
	if (handlerInfo.preferredAction == Ci.nsIHandlerInfo.useHelperApp) { //Ci.nsIHandlerInfo has keys: alwaysAsk:1, handleInternally:3, saveToDisk:0, useHelperApp:2, useSystemDefault:4
		//it i shandled internally so it probably is a web app
		if (handlerInfo.preferredApplicationHandler.uriTemplate) { //if app handler is set to local app handler that is default, than preferredApplicationHandler is left at what it was before. can identify if preferredApplicationHandler is stale by testing if `handlerInfo.alwaysAskBeforeHandling == true` OR `handlerInfo.preferredAction != Ci.Ci.nsIHandlerInfo.handleInternally`
			var preferredHandlerUriTemplate = handlerInfo.preferredApplicationHandler.uriTemplate;
		}
	} else {
		//its not handled interntally and for a web app to be a handler for it IT HAS to be set to Ci.nsIHandlerInfo.handleInternally
	}
	//end - determine if there is a preferred web app handler
	*/
	//start - mark installed handlers as installed in dom AND the active handler as active in dom
	for (var i=0; i<infoForWebmailHandlers.length; i++) {
		var info = infoForWebmailHandlers[i];
		if (uriTemplates_of_installedHandlers.indexOf(info.uriTemplate) > -1) {
			//yes its installed
			var thisRow = document.querySelector(info.circleSelector).parentNode.parentNode;
			//var thisStall = thisRow.querySelector('a.stall-me');
			thisRow.querySelector('.span5').classList.add('stalled');
			/*
			if (handlerInfo.preferredApplicationHandler.uriTemplate == info.uriTemplate) {
				var thisTog = thisRow.querySelector('a.act-toggle');
				thisTog.classList.add('active-me');
			}
			// cant do this way because if it used to be a web app handler (like y mail) and then they changed it to always ask (or a local app handler), the preferredApplicationHandler is left as it what it was last time. so it will be y mail even though it is at always ask (or local app handler)
			*/
			if (!handlerInfo.alwaysAskBeforeHandling && handlerInfo.preferredAction == Ci.nsIHandlerInfo.useHelperApp && handlerInfo.preferredApplicationHandler instanceof Ci.nsIWebHandlerApp && handlerInfo.preferredApplicationHandler.uriTemplate == info.uriTemplate) { //checking instanceof to make sure its not null or something with no uriTemplate
				var thisTog = thisRow.querySelector('a.act-toggle');
				thisTog.classList.add('active-me');
			}
		}
	}
	//end - mark installed handlers as installed in dom
}

function toggleStall(e) {
	//check if active then make it inactive if unisntalled
	
	var thisStall = e.target;
	if (thisStall.nodeName == 'I') {
		thisStall = thisStall.parentNode;
	}
	
	var thisToggle = thisStall.parentNode.querySelector('a.act-toggle');
	
	var thisRow = thisToggle.parentNode.parentNode.parentNode;
	var thisCircle = thisRow.querySelector('.span3 div');
	var circleClass = thisCircle.getAttribute('class');
	
	if (thisToggle.classList.contains('active-me')) {
		//Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'MailtoWebmails - Exception', 'Cannot uninstall this handler because it is currently set as the active mailto handler');
		var res = Services.prompt.confirm(Services.wm.getMostRecentWindow('navigator:browser'), 'MailtoWebmails - Enable "Always Ask"', 'This handler is currently set as the "Active" handler. If you uninstall this handler it will be made "Inactive" and will enable the "Always Ask" setting. Which means on all future clicks on "mailto:" links, Firefox will ask you which of the installed handlers you want to open the link with.');
		if (res) {
			if (circleAct(circleClass, UNINSTALL_HANDLER)) {
				thisToggle.classList.remove('active-me');
				thisStall.parentNode.classList.toggle('stalled');
				return true;
			} else {
				Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'MailtoWebmails - Error', 'Action failed, something went wrong, try looking in browser console');
				return false;
			}
		} else {
			return false;
		}
	}
	
	if (thisStall.parentNode.classList.contains('stalled')) {
		//uninstall
		var doact = UNINSTALL_HANDLER;
	} else {
		//install
		var doact = INSTALL_HANDLER;
	}
	
	if (circleAct(circleClass, doact)) {
		thisStall.parentNode.classList.toggle('stalled');
		return true;
	} else {
		Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'MailtoWebmails - Error', 'Action failed, something went wrong, try looking in browser console');
		return false;
	}
}

function toggleToActive(e) {
	var thisToggle = e.target;
	if (thisToggle.nodeName == 'I') {
		thisToggle = thisToggle.parentNode;
	}
	var thisRow = thisToggle.parentNode.parentNode.parentNode;
	var thisCircle = thisRow.querySelector('.span3 div');
	var circleClass = thisCircle.getAttribute('class');
	
	if (thisToggle.classList.contains('active-me')) {
		//this toggler clicked is active so forget it, exit
		//setting it to inactive. user wants it to always ask
		var res = Services.prompt.confirm(Services.wm.getMostRecentWindow('navigator:browser'), 'MailtoWebmails - Enable "Always Ask"', 'Are you sure want to set the only "Active" handler to "Inactive"? This will enable the "Always Ask" setting. Which means on all future clicks on "mailto:" links, Firefox will ask you which of the installed handlers you want to open the link with.');
		if (res) {					
			if (circleAct(circleClass, SET_HANDLER_INACTIVE)) {
				thisToggle.classList.remove('active-me');
				return true;
			} else {
				Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'MailtoWebmails - Error', 'Action failed, something went wrong, try looking in browser console');
				return false;
			}
		} else {
			return false;
		}
	}
	
	var thisStallParent = thisToggle.parentNode.parentNode;
	if (!thisStallParent.classList.contains('stalled')) {
		Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'MailtoWebmails - Exception', 'Cannot set this handler to active as it is not installed');
		//nevermind comment to right, because sometimes these inactive buttons are clickable, they are expecting it to do something, so do notify them that it cannot set to active as its not installed //not prompting anymore because i made the css so on hover its not a click pointer so its not "clickable" so it should do nothing. so in other words: if the button is not pointer on hover, then on click user should not expect something.
		return false;
	}
	
	if (circleAct(circleClass, SET_HANDLER_ACTIVE)) {
		var curActive = document.querySelector('a.active-me');
		if (curActive) {
			curActive.classList.remove('active-me');
		}
		thisToggle.classList.add('active-me');
		return true;
	} else {
		Services.prompt.alert(Services.wm.getMostRecentWindow('navigator:browser'), 'MailtoWebmails - Error', 'Action failed, something went wrong, try looking in browser console');
		return false;
	}
}

function circleAct(circleClass, act) {
	//selector should be text to select the circle
	//act: 0-install, 1-uninstall, 2-active, 3-inactive
	
	
	
	for (var i=0; i<infoForWebmailHandlers.length; i++) {
		var info = infoForWebmailHandlers[i];
		if (info.circleSelector == '.skills .' + circleClass) {
			break;
		}
		if (i == infoForWebmailHandlers.length) {
			throw new Error('could not find circleClass in infoForWebmailHandlers, circleClass = "' + circleClass + '"'); //this is dev error so throw rather than prompt
			return false; //wont get here as throw just quits all but just formality
		}
	}
	
	if (act != INSTALL_HANDLER) {
		var eps = Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(Ci.nsIExternalProtocolService);
		var handlerInfo = eps.getProtocolHandlerInfo('mailto');
		var handlers = handlerInfo.possibleApplicationHandlers;
	}
	
	switch (act) {
		case INSTALL_HANDLER:
			var protocol = 'mailto';
			var name = info.name;
			var myURISpec = info.uriTemplate;

			var handler = Cc["@mozilla.org/uriloader/web-handler-app;1"].createInstance(Ci.nsIWebHandlerApp);
			handler.name = info.name;
			handler.uriTemplate = info.uriTemplate;

			var eps = Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(Ci.nsIExternalProtocolService);
			var handlerInfo = eps.getProtocolHandlerInfo('mailto');
			handlerInfo.possibleApplicationHandlers.appendElement(handler, false);

			var hs = Cc["@mozilla.org/uriloader/handler-service;1"].getService(Ci.nsIHandlerService);
			hs.store(handlerInfo);
			break;
			
		case UNINSTALL_HANDLER:
			for (var i = 0; i < handlers.length; i++) {
				var handler = handlers.queryElementAt(i, Ci.nsIWebHandlerApp);

				if (handler.uriTemplate == info.uriTemplate) {
					if (handlerInfo.preferredApplicationHandler instanceof Ci.nsIWebHandlerApp && handler.equals(handlerInfo.preferredApplicationHandler)) { //have to check instnaceof because it may be that preferredApplicationHandler is `null`, must do this because if its `null` then `handler.equals(handlerInfo.preferredApplicationHandler)` throws `NS_ERROR_ILLEGAL_VALUE: Illegal value'Illegal value' when calling method: [nsIWebHandlerApp::equals]`

						//if the last preferredApplicationHandler was this then nullify it, just me trying to keep things not stale
						handlerInfo.preferredApplicationHandler = null;
						if (handlerInfo.preferredAction == Ci.nsIHandlerInfo.useHelperApp) {
							//it looks like the preferredAction was to use this helper app, so now that its no longer there we will have to ask what the user wants to do next time the uesrs clicks a mailto: link
							handlerInfo.alwaysAskBeforeHandling = true;
							handlerInfo.preferredAction = Ci.nsIHandlerInfo.alwaysAsk; //this doesnt really do anything but its just nice to be not stale. it doesnt do anything because firefox checks handlerInfo.alwaysAskBeforeHandling to decide if it should ask. so me doing this is just formality to be looking nice
						}
					}
					handlers.removeElementAt(i);
					i--;
				}
				var hs = Cc["@mozilla.org/uriloader/handler-service;1"].getService(Ci.nsIHandlerService);
				hs.store(handlerInfo);
			}
			break;
			
		case SET_HANDLER_ACTIVE:
			var foundHandler = false;
			handlers = handlers.enumerate();
			while (handlers.hasMoreElements()) {
				var handler = handlers.getNext();
				if (handler.QueryInterface(Ci.nsIWebHandlerApp).uriTemplate == info.uriTemplate) { //this is how i decided to indentify if the handler, by uriTemplate
					foundHandler = true;
					break;
				}
			}

			if (foundHandler) {
				//it was found. and in the while loop when i found it, i "break"ed out of the loop which left handlerInfo set at the yahoo mail handler
				//set this to the prefered handler as this handler is the y! mail handler
				handlerInfo.preferredAction = Ci.nsIHandlerInfo.useHelperApp; //Ci.nsIHandlerInfo has keys: alwaysAsk:1, handleInternally:3, saveToDisk:0, useHelperApp:2, useSystemDefault:4
				handlerInfo.preferredApplicationHandler = handler;
				handlerInfo.alwaysAskBeforeHandling = false;
				var hs = Cc["@mozilla.org/uriloader/handler-service;1"].getService(Ci.nsIHandlerService);
				hs.store(handlerInfo);
			} else {
				throw new Error('could not find yahoo mail handler. meaning i couldnt find a handler with uriTemplate of ...compose.mail.yahoo.... info = ' + uneval(info));
				return false;
			}
			break;
			
		case SET_HANDLER_INACTIVE:
			handlerInfo.preferredAction = Ci.nsIHandlerInfo.alwaysAsk; //Ci.nsIHandlerInfo has keys: alwaysAsk:1, handleInternally:3, saveToDisk:0, useHelperApp:2, useSystemDefault:4
			handlerInfo.preferredApplicationHandler = null;
			handlerInfo.alwaysAskBeforeHandling = true;
			var hs = Cc["@mozilla.org/uriloader/handler-service;1"].getService(Ci.nsIHandlerService);
			hs.store(handlerInfo);
			break;
			
		default:
			throw new Error('invalid act supplied, making this error rather than prompt because this is a dev error');
	}
	
	return true;
}

document.addEventListener('DOMContentLoaded', init, false);