const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://gre/modules/FileUtils.jsm');
Cu.import('resource://gre/modules/osfile.jsm');
/* start - infoForWebmailHandlers.jsm */ 
var myServices = {};

XPCOMUtils.defineLazyGetter(myServices, 'eps', function(){ return Cc['@mozilla.org/uriloader/external-protocol-service;1'].getService(Ci.nsIExternalProtocolService) });
XPCOMUtils.defineLazyGetter(myServices, 'hs', function(){ return Cc['@mozilla.org/uriloader/handler-service;1'].getService(Ci.nsIHandlerService) });

const infoForWebmailHandlers = [
	{
		name: 'AIM Mail',
		uriTemplate: 'http://webmail.aol.com/Mail/ComposeMessage.aspx?to=%s', //chrome mailto ext uses: `http://mail.aol.com/33490-311/aim-6/en-us/mail/compose-message.aspx?to={to}&cc={cc}&bcc={bcc}&subject={subject}&body={body}`
		circleSelector: '.skills .css' //this is for me to target the proper row in the dom of the prefs frontend document.getElementById(circleId).parentNode.parentNode is the row element
	},
	{
		name: 'FastMail',
		uriTemplate: 'https://www.fastmail.com/action/compose/?mailto=%s',
		circleSelector: '.skills .fastmail'
	},
	{
		name: 'GMail',
		uriTemplate: 'https://mail.google.com/mail/?extsrc=mailto&url=%s', //chrome mailto ext uses: `https://mail.google.com/mail/?view=cm&tf=1&to={to}&cc={cc}&bcc={bcc}&su={subject}&body={body}`
		circleSelector: '.skills .ai'
	},/*
	{
		name: 'GMX',
		uriTemplate: 'https://mail.google.com/mail/?extsrc=mailto&url=%s',
		circleSelector: '.skills .gmx'
	},*/
	{
		name: 'Lycos Mail',
		uriTemplate: 'https://zmail.zoho.com/mail/compose.do?extsrc=mailto&mode=compose&tp=zb&ct={to}',
		circleSelector: '.skills .lycos'
	},
	{
		name: 'Outlook Live',
		uriTemplate: 'https://mail.live.com/secure/start?action=compose&to=%s', //chrome mailto ext uses: `https://mail.live.com/default.aspx?rru=compose&to={to}&subject={subject}&body={body}&cc={cc}`
		circleSelector: '.skills .ps'
	},
	{
		name: 'QQMail',
		uriTemplate: 'http://www.mail.qq.com/cgi-bin/loginpage?delegate_url=%2Fcgi-bin%2Freadtemplate%3Ft%3Dcompose%26toemail%3D%s',
		circleSelector: '.skills .qq'
	},
	{
		name: 'Y! Mail',
		uriTemplate: 'https://compose.mail.yahoo.com/?To=%s', //chrome mailto ext uses: `http://compose.mail.yahoo.com/?To={to}&Cc={cc}&Bcc={bcc}&Subj={subject}&Body={body}`
		circleSelector: '.skills .html'
	},
	{
		name: 'Yandex.Mail',
		uriTemplate: 'https://mail.yandex.com/compose?mailto=%s',
		circleSelector: '.skills .yandex'
	},
	{
		name: 'ZOHO Mail',
		uriTemplate: 'https://zmail.zoho.com/mail/compose.do?extsrc=mailto&mode=compose&tp=zb&ct=%s',
		circleSelector: '.skills .zoho'
	}
];
/* end - infoForWebmailHandlers.jsm */ 
const INSTALL_HANDLER = 0;
const UNINSTALL_HANDLER = 1;
const SET_HANDLER_ACTIVE = 2;
const SET_HANDLER_INACTIVE = 3;

var gPArr;
var reInitTimeout;
var ds = null; //for aRDFObserver
/* start - aRDFObserver structure */
// is a nsIRDFObserver
var aRDFObserver = {
	onChange: function(aDataSource, aSource, aProperty, aOldTarget, aNewTarget) {
		if (aSource.ValueUTF8 == 'urn:scheme:handler:mailto') {
			console.log('mailto handler just changed');
			try {
				window.clearTimeout(reInitTimeout);
			} catch (ignore) {}
			reInitTimeout = window.setTimeout(function() {
				console.info('reiniting NOW');
				init();
			}, 500);
			//refresh my page
		}
	}
};
/* end - aRDFObserver structure */

function init() {
	//only on load should dontAddRdfObserver be !. so in all other times like "reiniting" must be true. as we dont want to add a 2nd+ rdf observer
	if (ds === null) {		
		var rdfs = Cc['@mozilla.org/rdf/rdf-service;1'].getService(Ci.nsIRDFService);
		var file = FileUtils.getFile('UMimTyp', []);
		var fileHandler = Services.io.getProtocolHandler('file').QueryInterface(Ci.nsIFileProtocolHandler);
		ds = rdfs.GetDataSourceBlocking(fileHandler.getURLSpecFromFile(file));
		ds.AddObserver(aRDFObserver);
	}
	var actToggles = document.querySelectorAll('a.act-toggle');
	Array.prototype.forEach.call(actToggles, function(actTog) {
		actTog.addEventListener('click', toggleToActive, false);
	});
	var stalls = document.querySelectorAll('a.stall-me');
	Array.prototype.forEach.call(stalls, function(stall) {
		stall.addEventListener('click', toggleStall, false);
	});
	
	//start - determine active handler
	var handlerInfo = myServices.eps.getProtocolHandlerInfo('mailto');
	console.log('hanlderInfo', handlerInfo);

	//end - determine active handler
	
	//start - find installed handlers
	var uriTemplates_of_installedHandlers = [];
	var handlers = handlerInfo.possibleApplicationHandlers.enumerate();
	while (handlers.hasMoreElements()) {
		var handler = handlers.getNext().QueryInterface(Ci.nsIWebHandlerApp);
		uriTemplates_of_installedHandlers.push(handler.uriTemplate);
	}
	console.info('uriTemplates_of_installedHandlers', uriTemplates_of_installedHandlers);
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
	//now that i watch 3rd party, i have to also now mark uninstalled handlers and inactive handlers as such
	var uriTemplates_matchingPopular = [];
	for (var i=0; i<infoForWebmailHandlers.length; i++) {
		var info = infoForWebmailHandlers[i];
		var thisRow = document.querySelector(info.circleSelector).parentNode.parentNode;
		var span5 = thisRow.querySelector('.span5');
		var thisTog = thisRow.querySelector('a.act-toggle');
		if (uriTemplates_of_installedHandlers.indexOf(info.uriTemplate) > -1) {
			uriTemplates_matchingPopular.push(info.uriTemplate);
			//yes its installed
			console.log('is installed info: ', info);
			span5.classList.add('stalled');
			/*
			if (handlerInfo.preferredApplicationHandler.uriTemplate == info.uriTemplate) {
				var thisTog = thisRow.querySelector('a.act-toggle');
				thisTog.classList.add('active-me');
			}
			// cant do this way because if it used to be a web app handler (like y mail) and then they changed it to always ask (or a local app handler), the preferredApplicationHandler is left as it what it was last time. so it will be y mail even though it is at always ask (or local app handler)
			*/
			if (!handlerInfo.alwaysAskBeforeHandling && handlerInfo.preferredAction == Ci.nsIHandlerInfo.useHelperApp && handlerInfo.preferredApplicationHandler instanceof Ci.nsIWebHandlerApp && handlerInfo.preferredApplicationHandler.uriTemplate == info.uriTemplate) { //checking instanceof to make sure its not null or something with no uriTemplate
				thisTog.classList.add('active-me');
			} else {
				thisTog.classList.remove('active-me');
			}
		} else {
			span5.classList.remove('stalled');
			thisTog.classList.remove('active-me');
		}
	}
	//end - mark installed handlers as installed in dom
	
	//start - read and do personal handlers
	var pInstalledHandlers = [];
	// find what handlers remain in the installed handlers that are not of popular, and put them into personal
	for (var i=0; i<uriTemplates_of_installedHandlers.length; i++) {
		if (uriTemplates_matchingPopular.indexOf(uriTemplates_of_installedHandlers[i]) == -1) {
			pInstalledHandlers.push(uriTemplates_of_installedHandlers[i]);
		}
	}
	
	gPArr = []; // in case becauseNoSuchFile in readP
	/*
	var readP = function() {
		var pomise_readIt = read_encoded(OS.Path.join(OS.Constants.Path.profileDir, 'mailtowebmails_personal-handlers.txt'), {encoding:'utf-8'});
		pomise_readIt.then(
			function(aVal) {
				console.log('Fullfilled - pomise_readIt - ', aVal);
				// start - do stuff here - pomise_readIt
				writePToDom();
				// end - do stuff here - pomise_readIt
			},
			function(aReason) {
				if (aReasonMax(aReason).becauseNoSuchFile) {
					writePToDom();
					return;
				}
				var rejObj = {name:'pomise_readIt', aReason:aReason};
				console.error('Rejected - pomise_readIt - ', rejObj);
				//deferred_createProfile.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'pomise_readIt', aCaught:aCaught};
				console.error('Caught - pomise_readIt - ', rejObj);
				//deferred_createProfile.reject(rejObj);
			}
		);
	};	
	var writePToDom = function() {
		console.info('pInstalledHandlers:', pInstalledHandlers);
		for (var i=0; i<pInstalledHandlers.length; i++) {
			console.info('we have a p installed handler:', pInstalledHandlers[i])
			var infoExists = handlerInJson('uriTemplate', pInstalledHandlers[i], gPArr);
			if (infoExists > -1) {
				
			} else {
				gPArr.push({
					name: '???',
					uriTemplate: pInstalledHandlers[i],
					color: getRandomColor(),
					image: '',
					desc: '???',
					hash: HashStringHelper(pInstalledHandlers[i])
				});
			}
		}
		
		for (var i=0; i<gPArr.length; i++) {
			appendPHandlerToDom.bind(null, gPArr[i].name, gPArr[i].color, gPArr[i].desc, gPArr[i].uriTemplate, gPArr[i].img, gPArr[i].hash)();
		}
	};
	
	readP();
	*/
	//end - read and do personal handlers
}
	
function handlerInJson(keyName, keyValue, jsonArr) {
	// jsonArr should be array like infoForWebmailHandlers
	
	// returns -1 if not found, else index in jsonArr
	
	for (var iii=0; iii<jsonArr.length; iii++) {
		if (jsonArr[iii][keyName] == keyValue) {
			return iii;
		}
	}
	
	return -1;
}

function installCustomHandler(aCustomHandlerInfo) {
	
		// list all mailtos and see if this is a duplicate
		var eps = Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(Ci.nsIExternalProtocolService);
		var handlerInfo = eps.getProtocolHandlerInfo('mailto');
		
		var shouldCallStore = false;
		//start - find installed handlers
		var handlers = handlerInfo.possibleApplicationHandlers.enumerate();
		while (handlers.hasMoreElements()) {
			var handler = handlers.getNext().QueryInterface(Ci.nsIWebHandlerApp);
			console.info('handler:', handler);
			if (handler.uriTemplate == aCustomHandlerInfo.urlhandler) {
				console.error('a handler with uriTemplate of', aCustomHandlerInfo.urlhandler, 'already exists!', handler, 'aCustomHandlerInfo:', aCustomHandlerInfo);
				return;
			}
		}
		// end - list all mailtos and see if this is a duplicate
		
	var protocol = 'mailto';
	var name = aCustomHandlerInfo.name;
	var newURIArgs = {
		aURL: aCustomHandlerInfo.uriTemplate,
		aOriginCharset: null,
		aBaseURI: null
	};
	var myURI = Services.io.newURI(newURIArgs.aURL, newURIArgs.aOriginCharset, newURIArgs.aBaseURI);
	var myURISpec = myURI.spec;


	var handler = Cc["@mozilla.org/uriloader/web-handler-app;1"].createInstance(Ci.nsIWebHandlerApp);
	handler.name = aCustomHandlerInfo.name;
	handler.uriTemplate = myURISpec;
	
	var aCustomDetailedDescription = JSON.parse(JSON.stringify(aCustomHandlerInfo));
	delete aCustomDetailedDescription.urihandler;
	//handler.detailedDescription = JSON.stringify(aCustomDetailedDescription);
	console.error('handler:', handler);

	var eps = Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(Ci.nsIExternalProtocolService);
	var handlerInfo = eps.getProtocolHandlerInfo(protocol);
	handlerInfo.possibleApplicationHandlers.appendElement(handler, false);

	if (handlerInfo.possibleApplicationHandlers.length > 1) {
		// May want to always ask user before handling because it now has multiple possibleApplicationsHandlers BUT dont have to
		//handlerInfo.alwaysAskBeforeHandling = true;
	}

	var hs = Cc["@mozilla.org/uriloader/handler-service;1"].getService(Ci.nsIHandlerService);
	hs.store(handlerInfo);
}

function appendPHandlerToDom(name, color, desc, uriTemplate, img, hash) {
	
	var pcontainer = document.getElementById('pcontainer');
	
	var customHandlerInfo = {
		name: name,
		color: color,
		desc: desc,
		uriTemplate: uriTemplate,
		img: img,
		handlerId: new Date().getTime(), // just temporary till server assigns one to this guy
		handlerIdIsTemp: true
	};
	
	try {
	var newURIArgs = {
		aURL: aCustomHandlerInfo.uriTemplate,
		aOriginCharset: null,
		aBaseURI: null
	};
	var myURI = Services.io.newURI(newURIArgs.aURL, newURIArgs.aOriginCharset, newURIArgs.aBaseURI);
	var myURISpec = myURI.spec;
	} catch(ex) {
		alert('ERROR: URL template provided is not in the format of a proper URL, please fix');
		return;
	}
	
	if (myURISpec.indexOf('%s') == -1) {
		alert('ERROR: URL template does not include a wildcard, it must have a "%s", this is where the "To" email will get filled in.');
		return;
	}
	
	var populatedTemplate = rowTemplate.slice();
	populatedTemplate[3][1]['data-handlerid'] = customHandlerInfo.handlerId;
	populatedTemplate[3][1]['data-urlhandler'] = uriTemplate;
	populatedTemplate[2][2][1].style = 'background-color:' + color + ';background-image:url(' + img + ')';
	populatedTemplate[3][2][2] = name;
	populatedTemplate[3][3][2] = desc;
	populatedTemplate[3][4][1].onclick = 'togAbil(' + hash + ')';
	populatedTemplate[3][5][1].onclick = 'togInst(' + hash + ')';
	
	pcontainer.appendChild(jsonToDOM(populatedTemplate, document, {}));
	
	ds.RemoveObserver(aRDFObserver);
	try {
		installCustomHandler(customHandlerInfo);
	} finally {
		ds.AddObserver(aRDFObserver);
	}
}

var rowTemplate =
[
	'div', {class:'row'},
		['div', {class:'span3'},
			['div', {class:'zoho', style:0}, // replace 0 with color `background-color:#fff` and img url
				['h3', {}] 
			]
		],
		['div', {class:'span5 stalled', 'data-handlerid':0, 'data-urlhandler':0},
			['h3', {},
				0, // replace with name
				['a', {class:'hire-me act-toggle', key:'togAbil'},
					['i', {class:'icon-user'}]
				]
			],
			['div', {class:'sp5desc'},
				0 // replace with desc
			],
			/*
			['div', {class:'expand-bg'},
				['span', {class:'expand', style:0}, // replace 0 with img so `background-img:url(blah)`
					'&nbsp;'
				]
			],
			*/
			['a', {class:'hire-me stall-me', onclick:0}, // replace with togAbil(hash of url)
				['i', {}]
			],
			['a', {class:'edit-personal hire-me stall-me', onclick:0}, // replace with togInst(hash of url)
				['i', {}]
			]
		]
];
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
		var handlerInfo = myServices.eps.getProtocolHandlerInfo('mailto');
		var handlers = handlerInfo.possibleApplicationHandlers;
	}
	console.info('removed aRDFObserver so can do circleAct without observer thinking its 3rd party');
	ds.RemoveObserver(aRDFObserver);
	try {
		switch (act) {
			case INSTALL_HANDLER:
				var protocol = 'mailto';
				var name = info.name;
				var myURISpec = info.uriTemplate;

				var handler = Cc['@mozilla.org/uriloader/web-handler-app;1'	].createInstance(Ci.nsIWebHandlerApp);
				handler.name = info.name;
				handler.uriTemplate = info.uriTemplate;

				var handlerInfo = myServices.eps.getProtocolHandlerInfo('mailto');
				handlerInfo.possibleApplicationHandlers.appendElement(handler, false);

				myServices.hs.store(handlerInfo);
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
					myServices.hs.store(handlerInfo);
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
					myServices.hs.store(handlerInfo);
				} else {
					throw new Error('could not find yahoo mail handler. meaning i couldnt find a handler with uriTemplate of ...compose.mail.yahoo.... info = ' + uneval(info));
				}
				break;
				
			case SET_HANDLER_INACTIVE:
				handlerInfo.preferredAction = Ci.nsIHandlerInfo.alwaysAsk; //Ci.nsIHandlerInfo has keys: alwaysAsk:1, handleInternally:3, saveToDisk:0, useHelperApp:2, useSystemDefault:4
				handlerInfo.preferredApplicationHandler = null;
				handlerInfo.alwaysAskBeforeHandling = true;
				myServices.hs.store(handlerInfo);
				break;
				
			default:
				throw new Error('invalid act supplied, making this error rather than prompt because this is a dev error');
		}
	} catch(ex) {
		throw(ex);
	} finally {
		//this finally block will run even though we throw in the catch block. see: https://gist.github.com/Noitidart/abeb5dc331dc322372e8
		console.info('added aRDFObserver back');
		ds.AddObserver(aRDFObserver);
	}
	return true; //will not return true even though the finally block runs if an error is thrown in catch
}

function personal_img(target) {
	var fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
	fp.init(Services.wm.getMostRecentWindow(null), 'Image Selection', Ci.nsIFilePicker.modeOpen);
	fp.appendFilters(Ci.nsIFilePicker.filterImages);

	var rv = fp.show();
	if (rv == Ci.nsIFilePicker.returnOK) {
		//console.log('fp.file:', fp.file);
		target.style.backgroundImage = 'url(' + Services.io.newFileURI(fp.file).spec + ')';
		target.classList.remove('no-custom-bg');
	}// else { // cancelled	}
}

function toggleTip(trueForForceShow_falseForForceHide) {
	var tip = document.getElementById('tip');
	if (trueForForceShow_falseForForceHide === true) {
		tip.style.opacity = 1;
		tip.style.marginLeft = '-25px';
	} else if (trueForForceShow_falseForForceHide === false) {
		tip.style.opacity = 0;
		tip.style.marginLeft = '-75px';
	} else {
		// toggle
		if (tip.style.opacity == 1) {
			tip.style.opacity = 0;
			tip.style.marginLeft = '-75px';
		} else {
			tip.style.opacity = 1;
			tip.style.marginLeft = '-25px';
		}
	}
}

function updatePersonalHandler() {
	// updates by wildcard url, if not found it inserts it
	var name = document.getElementById('pname').value;
	var desc = document.getElementById('pdesc').value;
	var color = document.getElementById('pcolor').value;
	var img = document.getElementById('pimg').style.backgroundImage;
	var url = document.getElementById('purl').value;
	var id = document.getElementById('handler_id').value;
	
	if (name == '' || desc == '' || url == '') {
		alert('Must fill out name, description, and url at the least');
		return;
	}
	
	console.info('img:', img);
	if (img.indexOf('url(') > -1) {
		img = img.substr(4);
		img = img.substr(0, img.length-1);
	}
	
	var infoExists = handlerInJson('uriTemplate', url, gPArr);
	console.info('infoExists:', infoExists)
	if (infoExists == -1) {
		gPArr.push({
			name: name,
			uriTemplate: url,
			color: color,
			image: img,
			desc: desc, 
			hash: HashStringHelper(url)
		});
		
		appendPHandlerToDom(name, color, desc, url, img, HashStringHelper(url));
	} else {
		alert('user did edit');
		gPArr[infoExists].name = name;
		//gPArr[infoExists].uriTemplate = url;
		gPArr[infoExists].color = color;
		gPArr[infoExists].image = img;
		gPArr[infoExists].desc = desc;
		//gPArr[infoExists].hash = HashStringHelper(url);
		console.info('hash:', gPArr[infoExists].hash)
		var targetRowFromEl = document.querySelector('[onclick*="' + gPArr[infoExists].hash + '"]');
		var elRow = targetRowFromEl.parentNode.parentNode;
		var circle = elRow.querySelector('.zoho');
		var inputs = elRow.querySelectorAll('input[type=text]');
		console.info('elRow:', elRow)
		console.info('circle:', circle)
		console.info('inputs:', inputs)
		var elName = inputs[0];
		var elUrl = inputs[1];
		var elDesc = inputs[2];
		
		elName.value = name;
		elDesc.value = desc;
		
		circle.style.backgroundImage = 'url(' + url + ')';
		circle.style.backgroundColor = color;
		
		// :todo: write to disk, if social shared, then update. also :todo: if edit, and url changes, then update hash rather then insert new as it does right now
	}
	


}

function togAbil(aHash) {
	alert('togging ABIL for aHash:' + aHash);
}

function togInst(aHash) {
	alert('togging INST for aHash:' + aHash);
}

function shouldShowTip() {
	var name = document.getElementById('pname').value;
	var desc = document.getElementById('pdesc').value;
	var url = document.getElementById('purl').value;
	
	if (url != '' && name != '' && desc != '') {
		toggleTip(true);
	} else {
		toggleTip(false);
	}
}
document.addEventListener('DOMContentLoaded', init, false);

window.addEventListener('unload', function() {
	ds.RemoveObserver(aRDFObserver);
	console.log('unloaded pref page so observer removed');
}, false);

// common helper functions

function read_encoded(path, options) {
	// because the options.encoding was introduced only in Fx30, this function enables previous Fx to use it
	// must pass encoding to options object, same syntax as OS.File.read >= Fx30
	// TextDecoder must have been imported with Cu.importGlobalProperties(['TextDecoder']);
	
	var deferred_read_encoded = new Deferred();
	
	if (options && !('encoding' in options)) {
		deferred_read_encoded.reject('Must pass encoding in options object, otherwise just use OS.File.read');
		return deferred_read_encoded.promise;
	}
	
	if (options && Services.vc.compare(Services.appinfo.version, 30) < 0) { // tests if version is less then 30
		//var encoding = options.encoding; // looks like i dont need to pass encoding to TextDecoder, not sure though for non-utf-8 though
		delete options.encoding;
	}
	var promise_readIt = OS.File.read(path, options);
	
	promise_readIt.then(
		function(aVal) {
			console.log('Fullfilled - promise_readIt - ', {a:{a:aVal}});
			// start - do stuff here - promise_readIt
			var readStr;
			if (Services.vc.compare(Services.appinfo.version, 30) < 0) { // tests if version is less then 30
				readStr = getTxtDecodr().decode(aVal); // Convert this array to a text
			} else {
				readStr = aVal;
			}
			deferred_read_encoded.resolve(readStr);
			// end - do stuff here - promise_readIt
		},
		function(aReason) {
			var rejObj = {name:'promise_readIt', aReason:aReason};
			console.error('Rejected - promise_readIt - ', rejObj);
			deferred_read_encoded.reject(rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_readIt', aCaught:aCaught};
			console.error('Caught - promise_readIt - ', rejObj);
			deferred_read_encoded.reject(rejObj);
		}
	);
	
	return deferred_read_encoded.promise;
}

/*dom insertion library function from MDN - https://developer.mozilla.org/en-US/docs/XUL_School/DOM_Building_and_HTML_Insertion*/

function jsonToDOM(xml, doc, nodes) {
	
	var namespaces = {
		html: 'http://www.w3.org/1999/xhtml',
		xul: 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul'
	};
	var defaultNamespace = namespaces.html;
	
    function namespace(name) {
        var m = /^(?:(.*):)?(.*)$/.exec(name);        
        return [namespaces[m[1]], m[2]];
    }

    function tag(name, attr) {
        if (Array.isArray(name)) {
            var frag = doc.createDocumentFragment();
            Array.forEach(arguments, function (arg) {
                if (!Array.isArray(arg[0]))
                    frag.appendChild(tag.apply(null, arg));
                else
                    arg.forEach(function (arg) {
                        frag.appendChild(tag.apply(null, arg));
                    });
            });
            return frag;
        }

        var args = Array.slice(arguments, 2);
        var vals = namespace(name);
        var elem = doc.createElementNS(vals[0] || defaultNamespace, vals[1]);

        for (var key in attr) {
            var val = attr[key];
            if (nodes && key == 'key')
                nodes[val] = elem;

            vals = namespace(key);
            if (typeof val == 'function')
                elem.addEventListener(key.replace(/^on/, ''), val, false);
            else
                elem.setAttributeNS(vals[0] || '', vals[1], val);
        }
        args.forEach(function(e) {
			try {
				elem.appendChild(
									Object.prototype.toString.call(e) == '[object Array]'
									?
										tag.apply(null, e)
									:
										e instanceof doc.defaultView.Node
										?
											e
										:
											doc.createTextNode(e)
								);
			} catch (ex) {
				elem.appendChild(doc.createTextNode(ex));
			}
        });
        return elem;
    }
    return tag.apply(null, xml);
}
/*end - dom insertion library function from MDN*/

function getRandomColor() {
	// http://stackoverflow.com/a/1484514/1828637
    var letters = '0123456789ABCDEF'.split('');
    var color = '#';
    for (var i = 0; i < 6; i++ ) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function Deferred() {
	// update 062115 for typeof
	if (typeof(Promise) != 'undefined' && Promise.defer) {
		//need import of Promise.jsm for example: Cu.import('resource:/gree/modules/Promise.jsm');
		return Promise.defer();
	} else if (typeof(PromiseUtils) != 'undefined'  && PromiseUtils.defer) {
		//need import of PromiseUtils.jsm for example: Cu.import('resource:/gree/modules/PromiseUtils.jsm');
		return PromiseUtils.defer();
	} else {
		/* A method to resolve the associated Promise with the value passed.
		 * If the promise is already settled it does nothing.
		 *
		 * @param {anything} value : This value is used to resolve the promise
		 * If the value is a Promise then the associated promise assumes the state
		 * of Promise passed as value.
		 */
		this.resolve = null;

		/* A method to reject the assocaited Promise with the value passed.
		 * If the promise is already settled it does nothing.
		 *
		 * @param {anything} reason: The reason for the rejection of the Promise.
		 * Generally its an Error object. If however a Promise is passed, then the Promise
		 * itself will be the reason for rejection no matter the state of the Promise.
		 */
		this.reject = null;

		/* A newly created Pomise object.
		 * Initially in pending state.
		 */
		this.promise = new Promise(function(resolve, reject) {
			this.resolve = resolve;
			this.reject = reject;
		}.bind(this));
		Object.freeze(this);
	}
}

function aReasonMax(aReason) {
	var deepestReason = aReason;
	while (deepestReason.hasOwnProperty('aReason') || deepestReason.hasOwnProperty()) {
		if (deepestReason.hasOwnProperty('aReason')) {
			deepestReason = deepestReason.aReason;
		} else if (deepestReason.hasOwnProperty('aCaught')) {
			deepestReason = deepestReason.aCaught;
		}
	}
	return deepestReason;
}

var txtDecodr; // holds TextDecoder if created
function getTxtDecodr() {
	if (!txtDecodr) {
		txtDecodr = new TextDecoder();
	}
	return txtDecodr;
}
var txtEncodr; // holds TextDecoder if created
function getTxtEncodr() {
	if (!txtEncodr) {
		txtEncodr = new TextEncoder();
	}
	return txtEncodr;
}
var HashString = (function (){
	/**
	 * Javascript implementation of
	 * https://hg.mozilla.org/mozilla-central/file/0cefb584fd1a/mfbt/HashFunctions.h
	 * aka. the mfbt hash function.
	 */ 
  // Note: >>>0 is basically a cast-to-unsigned for our purposes.
  const encoder = getTxtEncodr();
  const kGoldenRatio = 0x9E3779B9;

  // Multiply two uint32_t like C++ would ;)
  const mul32 = (a, b) => {
    // Split into 16-bit integers (hi and lo words)
    var ahi = (a >> 16) & 0xffff;
    var alo = a & 0xffff;
    var bhi = (b >> 16) & 0xffff
    var blo = b & 0xffff;
    // Compute new hi and lo seperately and recombine.
    return (
      (((((ahi * blo) + (alo * bhi)) & 0xffff) << 16) >>> 0) +
      (alo * blo)
    ) >>> 0;
  };

  // kGoldenRatioU32 * (RotateBitsLeft32(aHash, 5) ^ aValue);
  const add = (hash, val) => {
    // Note, cannot >> 27 here, but / (1<<27) works as well.
    var rotl5 = (
      ((hash << 5) >>> 0) |
      (hash / (1<<27)) >>> 0
    ) >>> 0;
    return mul32(kGoldenRatio, (rotl5 ^ val) >>> 0);
  }

  return function(text) {
    // Convert to utf-8.
    // Also decomposes the string into uint8_t values already.
    var data = encoder.encode(text);

    // Compute the actual hash
    var rv = 0;
    for (var c of data) {
      rv = add(rv, c | 0);
    }
    return rv;
  };
})();

var _cache_HashStringHelper = {};
function HashStringHelper(aText) {
	if (!(aText in _cache_HashStringHelper)) {
		_cache_HashStringHelper[aText] = HashString(aText);
	}
	return _cache_HashStringHelper[aText];
}