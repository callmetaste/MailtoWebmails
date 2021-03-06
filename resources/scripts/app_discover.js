

// Imports
const {classes: Cc, interfaces: Ci, manager: Cm, results: Cr, utils: Cu, Constructor: CC} = Components;
// Cm.QueryInterface(Ci.nsIComponentRegistrar);
// Cu.import('resource://gre/modules/devtools/Console.jsm');
Cu.import('resource://gre/modules/osfile.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');

// Globals
var core = {
	addon: {
		id: 'MailtoWebmails@jetpack',
		path: {
			locale: 'chrome://mailtowebmails/locale/'
		},
		cache_key: 'v2.6' // set to version on release
	}
}

var myServices = {};
XPCOMUtils.defineLazyGetter(myServices, 'eps', function(){ return Cc['@mozilla.org/uriloader/external-protocol-service;1'].getService(Ci.nsIExternalProtocolService) });
XPCOMUtils.defineLazyGetter(myServices, 'hs', function(){ return Cc['@mozilla.org/uriloader/handler-service;1'].getService(Ci.nsIHandlerService) });
XPCOMUtils.defineLazyGetter(myServices, 'sb', function () { return Services.strings.createBundle(core.addon.path.locale + 'app.properties?' + core.addon.cache_key); /* Randomize URI to work around bug 719376 */ });

const mailtoServicesObjEntryTemplate = {
	name: '',
	url_template: '',
	old_url_templates: [],
	description: '',
	icon_dataurl: '',
	color: '',
	group: 1,
	update_time: 0
};

const userBasedProps = {
	installed: 1,
	active: 1,
	updated: 1,
	new: 1
};
/*
var gCFMM = contentMMFromContentWindow_Method2(window);

gCFMM.sendAsyncMessage(core.addon.id, {aTopic:'clientRequest_adoptMeAndInit'});
*/

const JETPACK_DIR_BASENAME = 'jetpack';
const OSPath_installedServices = OS.Path.join(OS.Constants.Path.profileDir, JETPACK_DIR_BASENAME, core.addon.id, 'simple-storage', 'pop_or_stalled.json');

var	ANG_APP = angular.module('mailtowebmails', [])
	.config(['$sceDelegateProvider', function($sceDelegateProvider) {
		$sceDelegateProvider.resourceUrlWhitelist(['self', 'chrome://mailtowebmails/**/*.htm']);
	}])
	.directive('row', [function() {
		return {
			restrict: 'E',
			templateUrl: 'chrome://mailtowebmails/content/resources/directives/row.htm'
		};
	}])
	.controller('BodyController', ['$scope', '$sce', function($scope, $sce) {

		var MODULE = this;

		MODULE.mailto_services = [];
		MODULE.mailto_services_updated_details = {};
		MODULE.editing_handler_id = null; // id is uriTemplate/url_handler
		MODULE.attn_msg = $sce.trustAsHtml(myServices.sb.GetStringFromName('attn_connecting'));

		MODULE.toggle_active = function(aServiceEntry) {
			if (!aServiceEntry.active) {
				for (var i=0; i<MODULE.mailto_services.length; i++) {
					MODULE.mailto_services[i].active = false;
				}
				aServiceEntry.active = true;

				// find this handler and set it as active
				var handlerInfoXPCOM = myServices.eps.getProtocolHandlerInfo('mailto');
				var handlers = handlerInfoXPCOM.possibleApplicationHandlers.enumerate();
				while (handlers.hasMoreElements()) {
					try {
						var handler = handlers.getNext().QueryInterface(Ci.nsIWebHandlerApp);
					} catch (ignore) {}
					if (handler.uriTemplate == aServiceEntry.url_template) {
						// found it
						handlerInfoXPCOM.preferredAction = Ci.nsIHandlerInfo.useHelperApp; //Ci.nsIHandlerInfo has keys: alwaysAsk:1, handleInternally:3, saveToDisk:0, useHelperApp:2, useSystemDefault:4
						handlerInfoXPCOM.preferredApplicationHandler = handler;
						handlerInfoXPCOM.alwaysAskBeforeHandling = false;
						break;
					}
				}
				// :todo: troubleshoot, if not found
			} else {
				aServiceEntry.active = false;

				// implement to firefox, to ask on next click, as this one was active
				// ensure that this handler was active
				var handlerInfoXPCOM = myServices.eps.getProtocolHandlerInfo('mailto');

				if (handlerInfoXPCOM.preferredApplicationHandler) {
					try {
						handlerInfoXPCOM.preferredApplicationHandler.QueryInterface(Ci.nsIWebHandlerApp); // so it gets the uriTemplate property
					} catch (ignore) {}
				}


				if (handlerInfoXPCOM.preferredAction == Ci.nsIHandlerInfo.useHelperApp && handlerInfoXPCOM.preferredApplicationHandler && handlerInfoXPCOM.preferredApplicationHandler.uriTemplate && handlerInfoXPCOM.preferredApplicationHandler.uriTemplate == aServiceEntry.url_template) {
					// yes it was active, lets unset it
					handlerInfoXPCOM.alwaysAskBeforeHandling = true;
					handlerInfoXPCOM.preferredAction = Ci.nsIHandlerInfo.alwaysAsk; //this doesnt really do anything but its just nice to be not stale. it doesnt do anything because firefox checks handlerInfo.alwaysAskBeforeHandling to decide if it should ask. so me doing this is just formality to be looking nice
					handlerInfoXPCOM.preferredApplicationHandler = null;
				} // :todo: troubleshoot, if it wasnt active maybe
			}
			myServices.hs.store(handlerInfoXPCOM);
		};

		MODULE.toggle_install = function(aServiceEntry) {
			// on uninstall, if it is discovered/custom/social/presonal
			aServiceEntry.installed = !aServiceEntry.installed;
			if (!aServiceEntry.installed) {
				aServiceEntry.active = false;
			}

			// implement update to firefox
			var handlerInfoXPCOM = myServices.eps.getProtocolHandlerInfo('mailto');
			if (aServiceEntry.installed) {
				var handler = Cc["@mozilla.org/uriloader/web-handler-app;1"].createInstance(Ci.nsIWebHandlerApp);
				handler.name = aServiceEntry.name;
				handler.uriTemplate = aServiceEntry.url_template;
				handlerInfoXPCOM.possibleApplicationHandlers.appendElement(handler, false);
				toggleServiceFromFile(1, aServiceEntry);
			} else {

				var preferredHandlerIsWebApp;
				if (handlerInfoXPCOM.preferredApplicationHandler) {
					try {
						handlerInfoXPCOM.preferredApplicationHandler.QueryInterface(Ci.nsIWebHandlerApp); // so it gets the uriTemplate property
						preferredHandlerIsWebApp = true;
					} catch (ex) {
						preferredHandlerIsWebApp = false;
					}
				}

				var nHandlers = handlerInfoXPCOM.possibleApplicationHandlers.length;
				for (var i=0; i<nHandlers; i++) {
					var handlerQI = handlerInfoXPCOM.possibleApplicationHandlers.queryElementAt(i, Ci.nsIWebHandlerApp);
					// cant remove if its the curently preferred, so check that, and if it is, then unsert it as preferred
					if (handlerInfoXPCOM.preferredAction == Ci.nsIHandlerInfo.useHelperApp && handlerInfoXPCOM.preferredApplicationHandler && handlerInfoXPCOM.preferredApplicationHandler.uriTemplate && handlerInfoXPCOM.preferredApplicationHandler.uriTemplate == aServiceEntry.url_template) {
						//it looks like the preferredAction was to use this helper app, so now that its no longer there we will have to ask what the user wants to do next time the uesrs clicks a mailto: link
						handlerInfoXPCOM.alwaysAskBeforeHandling = true;
						handlerInfoXPCOM.preferredAction = Ci.nsIHandlerInfo.alwaysAsk; //this doesnt really do anything but its just nice to be not stale. it doesnt do anything because firefox checks handlerInfo.alwaysAskBeforeHandling to decide if it should ask. so me doing this is just formality to be looking nice
						handlerInfoXPCOM.preferredApplicationHandler = null;
					}
					if (handlerQI.uriTemplate == aServiceEntry.url_template) {
						handlerInfoXPCOM.possibleApplicationHandlers.removeElementAt(i);
						break;
					}
				}
				toggleServiceFromFile(0, aServiceEntry);
			}
			myServices.hs.store(handlerInfoXPCOM);
		};

		MODULE.edit = function(aServiceEntry) {

		};

		MODULE.add = function() {

		};

		MODULE.info = function() {

		};

		MODULE.info();
	}]);
var gAngScope
var gAngInjector;
var gHandlers = [];
var gFileJson;
function doOnLoad() {
	var gAngBody = angular.element(document.body);
	gAngScope = gAngBody.scope();
	gAngInjector = gAngBody.injector();

	var promise_readInstalledServices = read_encoded(OSPath_installedServices, {encoding:'utf-8'});

	// check and get whats currently installed/active
	var handlerInfoXPCOM = myServices.eps.getProtocolHandlerInfo('mailto');

    //start - find installed handlers
    var handlersXPCOM = handlerInfoXPCOM.possibleApplicationHandlers.enumerate();

	var handlers = [];
    while (handlersXPCOM.hasMoreElements()) {
		try {
        	var handler = handlersXPCOM.getNext().QueryInterface(Ci.nsIWebHandlerApp);
		} catch(ex) {

			continue;
		}
		handlers.push(handler);

    }
	gHandlers = handlers;

	promise_readInstalledServices.then(
		function(aVal) {

			// start - do stuff here - promise_readInstalledServices
			gFileJson = JSON.parse(aVal);
			tryUpdate();
			// end - do stuff here - promise_readInstalledServices
		},
		function(aReason) {
			var rejObj = {name:'promise_readInstalledServices', aReason:aReason};

			// deferred_createProfile.reject(rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_readInstalledServices', aCaught:aCaught};

			// deferred_createProfile.reject(rejObj);
		}
	);

}

function retryUpdate() {
	gAngScope.BC.attn_msg = gAngInjector.get('$sce').trustAsHtml(myServices.sb.GetStringFromName('attn_checking-updates'));
	gAngScope.$digest();
	setTimeout(tryUpdate, 200);
}

function tryUpdate() {
	var postJson = {
		latestUpdateTime: 0,
		discoveredServices: []
	};
	for (var i=0; i<gAngScope.BC.mailto_services.length; i++) {
		if (gAngScope.BC.mailto_services[i].update_time > postJson.latestUpdateTime) {
			postJson.latestUpdateTime = gAngScope.BC.mailto_services[i].update_time;
		}
		if (gAngScope.BC.mailto_services[i].group == 1) {
			postJson.discoveredServices.push(gAngScope.BC.mailto_services[i].url_template);
		}
	}
	var promise_fetchUpdates = xhr('http://mailtowebmails.site40.net/ajax/fetch_discover.php', {
		aResponseType: 'json',
		aPostData: {
			json: JSON.stringify(postJson)
		},
		Headers: {
			'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
		},
		aTimeout: 3000
	});
	promise_fetchUpdates.then(
		function(aVal) {

			// start - do stuff here - promise_fetchUpdates
			if (aVal.response === null) {
				// for 000webhost we get status 200 and responseURL of "http://error404.000webhost.com/?" when page doesnt exist
				gAngScope.BC.attn_msg = gAngInjector.get('$sce').trustAsHtml(myServices.sb.GetStringFromName('attn_server-down'));
			} else {
				if (aVal.response.status != 'ok') {
					gAngScope.BC.attn_msg = gAngInjector.get('$sce').trustAsHtml(aVal.response.reason);
				} else {
					gAngScope.BC.attn_msg = null;

					var responseJson = aVal.response;


					var responseHandlers = responseJson.social_handlers;

					// delete from responseHandlers whatever is installed // as only getting group 1, so if its installed then it shows. if uninstalled it does not exist on user
					for (var server_url_template in responseHandlers) {
						var server_old_url_templates = responseHandlers[server_url_template].old_url_templates;
						for (var i=0; i<gHandlers.length; i++) {
							// :todo: wekaness here, i should see if there are old_url_templates for this installed handler (but i cant do that right now as i dont read the installed file info before this). because if user installed a social handler, and then edited its uriTemplate, and that was not yet approved, it will show here as well
							var installed_url_template = gHandlers[i].uriTemplate;
							var installed_old_url_templates = [];
							// get installed_old_url_templates from file
							for (var j=0; j<gFileJson.length; j++) {
								var gFileJsonOldUrlTemplates = gFileJson[j].old_url_templates;
								if (gFileJson[j].url_template == installed_url_template) {
									installed_old_url_templates = gFileJson[j].old_url_templates;
									break;
								} else if (gFileJsonOldUrlTemplates.indexOf(installed_url_template) > -1) {
									installed_old_url_templates = gFileJson[j].old_url_templates;
									break;
								}
							}
							// end - get installed_old_url_templates from file

							// now test if its installed
							if (areUrlTemplatesOfSame(installed_url_template, installed_old_url_templates, server_url_template, server_old_url_templates)) {

								delete responseHandlers[server_url_template];
								break;
							}
						}
					}

					gHandlers = null;

					// create mailto_services obj
					for (var url_template in responseHandlers) {
						gAngScope.BC.mailto_services.push(responseHandlers[url_template]);
					}
				}
			}
			gAngScope.$digest();
			// end - do stuff here - promise_fetchUpdates
		},
		function(aReason) {
			var rejObj = {name:'promise_fetchUpdates', aReason:aReason};

			gAngScope.BC.attn_msg = gAngInjector.get('$sce').trustAsHtml(myServices.sb.GetStringFromName('attn_server-down'));
			gAngScope.$digest();
			// deferred_createProfile.reject(rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_fetchUpdates', aCaught:aCaught};

			// deferred_createProfile.reject(rejObj);
		}
	);
}

function areUrlTemplatesOfSame(aUrlTemplate_1, aOldUrlTemplates_1, aUrlTemplate_2, aOldUrlTemplates_2) {
	// tests if handler 1 is same as handler 2 by checking url_template and old_url_templates

	// test if aUrlTemplate_1 is the same as aUrlTemplate_2
	if (aUrlTemplate_1 == aUrlTemplate_2) {
		return true;
	}

	// test if aUrlTemplate_1 is in aOldUrlTemplates_2
	if (aOldUrlTemplates_2.indexOf(aUrlTemplate_1) > -1) {
		return true;
	}

	// test if aUrlTemplate_2 is in aOldUrlTemplates_1
	if (aOldUrlTemplates_1.indexOf(aUrlTemplate_2) > -1) {
		return true;
	}

	// test if any of aOldUrlTemplates_1 are in aOldUrlTemplates_2 (this is same as doing reverse test of if any aOldUrlTemplates_2 are in aOldUrlTemplates_1)
	for (var l=0; l<aOldUrlTemplates_1.length; l++) {
		for (var m=0; m<aOldUrlTemplates_2.length; m++) {
			if (aOldUrlTemplates_1[l] == aOldUrlTemplates_2[m]) {
				return true;
			}
		}
	}

	return false;
}

function toggleServiceFromFile(aAddOrRemove, aServiceEntry) {
	// set aAddOrRemove to 0 for removing, and to 1 for adding
	// if 0 and not there, it wont do anything as its already not there - same goes for 1
	var file_json;

	var do_readFile = function() {
		var promise_readInstalledServices = read_encoded(OSPath_installedServices, {encoding:'utf-8'});
		promise_readInstalledServices.then(
			function(aVal) {

				// start - do stuff here - promise_readInstalledServices
				file_json = JSON.parse(aVal);

				do_checkFileJson();
				// end - do stuff here - promise_readInstalledServices
			},
			function(aReason) {
				if (aReasonMax(aReason).becauseNoSuchFile) {
					file_json = [];
					do_checkFileJson();
				} else {
					var rejObj = {name:'promise_readInstalledServices', aReason:aReason};

					// deferred_createProfile.reject(rejObj);
				}
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_readInstalledServices', aCaught:aCaught};

				// deferred_createProfile.reject(rejObj);
			}
		);
	};

	var do_checkFileJson = function() {

		var itFound = false;
		var itUpdated = false;
		for (var i=0; i<file_json.length; i++) {
			if (file_json[i].url_template == aServiceEntry.url_template) {
				itFound = true;
				break;
			}
		}

		if (aAddOrRemove) {
			// devuser wants add
			if (itFound) {
				// its already there, so do nothing
			} else {
				// add it
				itUpdated = true;
				var pushObj = {};
				for (var p in mailtoServicesObjEntryTemplate) {
					pushObj[p] = aServiceEntry[p];
				}
				file_json.push(pushObj);
			}
		} else {
			// devuser wants remove
			if (!itFound) {
				// its already not there, so do nothing
			} else {
				// remove it
				itUpdated = true;
				file_json.splice(i, 1);
			}
		}

		if (itUpdated) {
			do_writeUpdated();
		}
	};

	var do_writeUpdated = function() {
		// only called if json was updated
		var stringified = JSON.stringify(file_json);

		var promise_overwrite = tryOsFile_ifDirsNoExistMakeThenRetry('writeAtomic', [OSPath_installedServices, stringified, {
			tmpPath: OSPath_installedServices + '.tmp',
			encoding: 'utf-8',
			noOverwrite: false
		}], OS.Constants.Path.profileDir);
		promise_overwrite.then(
			function(aVal) {

				// start - do stuff here - promise_overwrite
				// end - do stuff here - promise_overwrite
			},
			function(aReason) {
				var rejObj = {name:'promise_overwrite', aReason:aReason};

				// deferred_createProfile.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_overwrite', aCaught:aCaught};

				// deferred_createProfile.reject(rejObj);
			}
		);
	};

	do_readFile();
}

document.addEventListener('DOMContentLoaded', doOnLoad, false);

// start - common helper functions
function contentMMFromContentWindow_Method2(aContentWindow) {
	return aContentWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                         .getInterface(Ci.nsIDocShell)
                         .QueryInterface(Ci.nsIInterfaceRequestor)
                         .getInterface(Ci.nsIContentFrameMessageManager);
}
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

			deferred_read_encoded.reject(rejObj);
		}
	).catch(
		function(aCaught) {
			var rejObj = {name:'promise_readIt', aCaught:aCaught};

			deferred_read_encoded.reject(rejObj);
		}
	);

	return deferred_read_encoded.promise;
}
function makeDir_Bug934283(path, options) {
	// pre FF31, using the `from` option would not work, so this fixes that so users on FF 29 and 30 can still use my addon
	// the `from` option should be a string of a folder that you know exists for sure. then the dirs after that, in path will be created
	// for example: path should be: `OS.Path.join('C:', 'thisDirExistsForSure', 'may exist', 'may exist2')`, and `from` should be `OS.Path.join('C:', 'thisDirExistsForSure')`
	// options of like ignoreExisting is exercised on final dir

	if (!options || !('from' in options)) {

		throw new Error('you have no need to use this, as this is meant to allow creation from a folder that you know for sure exists, you must provide options arg and the from key');
	}

	if (path.toLowerCase().indexOf(options.from.toLowerCase()) == -1) {

		throw new Error('The `from` string was not found in `path` string');
	}

	var options_from = options.from;
	delete options.from;

	var dirsToMake = OS.Path.split(path).components.slice(OS.Path.split(options_from).components.length);


	var deferred_makeDir_Bug934283 = new Deferred();
	var promise_makeDir_Bug934283 = deferred_makeDir_Bug934283.promise;

	var pathExistsForCertain = options_from;
	var makeDirRecurse = function() {
		pathExistsForCertain = OS.Path.join(pathExistsForCertain, dirsToMake[0]);
		dirsToMake.splice(0, 1);
		var promise_makeDir = OS.File.makeDir(pathExistsForCertain, options);
		promise_makeDir.then(
			function(aVal) {

				if (dirsToMake.length > 0) {
					makeDirRecurse();
				} else {
					deferred_makeDir_Bug934283.resolve('this path now exists for sure: "' + pathExistsForCertain + '"');
				}
			},
			function(aReason) {
				var rejObj = {
					promiseName: 'promise_makeDir',
					aReason: aReason,
					curPath: pathExistsForCertain
				};

				deferred_makeDir_Bug934283.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_makeDir', aCaught:aCaught};

				deferred_makeDir_Bug934283.reject(rejObj); // throw aCaught;
			}
		);
	};
	makeDirRecurse();

	return promise_makeDir_Bug934283;
}
function tryOsFile_ifDirsNoExistMakeThenRetry(nameOfOsFileFunc, argsOfOsFileFunc, fromDir, aOptions={}) {
	//last update: 061215 0303p - verified worker version didnt have the fix i needed to land here ALSO FIXED so it handles neutering of Fx37 for writeAtomic and I HAD TO implement this fix to worker version, fix was to introduce aOptions.causesNeutering
	// aOptions:
		// causesNeutering - default is false, if you use writeAtomic or another function and use an ArrayBuffer then set this to true, it will ensure directory exists first before trying. if it tries then fails the ArrayBuffer gets neutered and the retry will fail with "invalid arguments"

	// i use this with writeAtomic, copy, i havent tested with other things
	// argsOfOsFileFunc is array of args
	// will execute nameOfOsFileFunc with argsOfOsFileFunc, if rejected and reason is directories dont exist, then dirs are made then rexecute the nameOfOsFileFunc
	// i added makeDir as i may want to create a dir with ignoreExisting on final dir as was the case in pickerIconset()
	// returns promise

	var deferred_tryOsFile_ifDirsNoExistMakeThenRetry = new Deferred();

	if (['writeAtomic', 'copy', 'makeDir'].indexOf(nameOfOsFileFunc) == -1) {
		deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject('nameOfOsFileFunc of "' + nameOfOsFileFunc + '" is not supported');
		// not supported because i need to know the source path so i can get the toDir for makeDir on it
		return deferred_tryOsFile_ifDirsNoExistMakeThenRetry.promise; //just to exit further execution
	}

	// setup retry
	var retryIt = function() {

		var promise_retryAttempt = OS.File[nameOfOsFileFunc].apply(OS.File, argsOfOsFileFunc);
		promise_retryAttempt.then(
			function(aVal) {

				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.resolve('retryAttempt succeeded');
			},
			function(aReason) {
				var rejObj = {name:'promise_retryAttempt', aReason:aReason};

				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); //throw rejObj;
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_retryAttempt', aCaught:aCaught};

				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); // throw aCaught;
			}
		);
	};

	// popToDir
	var toDir;
	var popToDir = function() {
		switch (nameOfOsFileFunc) {
			case 'writeAtomic':
				toDir = OS.Path.dirname(argsOfOsFileFunc[0]);
				break;

			case 'copy':
				toDir = OS.Path.dirname(argsOfOsFileFunc[1]);
				break;

			case 'makeDir':
				toDir = OS.Path.dirname(argsOfOsFileFunc[0]);
				break;

			default:
				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject('nameOfOsFileFunc of "' + nameOfOsFileFunc + '" is not supported');
				return; // to prevent futher execution
		}
	};

	// setup recurse make dirs
	var makeDirs = function() {
		if (!toDir) {
			popToDir();
		}
		var promise_makeDirsRecurse = makeDir_Bug934283(toDir, {from: fromDir});
		promise_makeDirsRecurse.then(
			function(aVal) {

				retryIt();
			},
			function(aReason) {
				var rejObj = {name:'promise_makeDirsRecurse', aReason:aReason};

				/*
				if (aReason.becauseNoSuchFile) {

					makeDirs();
				} else {
					// did not get becauseNoSuchFile, which means the dirs exist (from my testing), so reject with this error
				*/
					deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); //throw rejObj;
				/*
				}
				*/
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_makeDirsRecurse', aCaught:aCaught};

				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); // throw aCaught;
			}
		);
	};

	var doInitialAttempt = function() {
		var promise_initialAttempt = OS.File[nameOfOsFileFunc].apply(OS.File, argsOfOsFileFunc);

		promise_initialAttempt.then(
			function(aVal) {

				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.resolve('initialAttempt succeeded');
			},
			function(aReason) {
				var rejObj = {name:'promise_initialAttempt', aReason:aReason};

				if (aReason.becauseNoSuchFile) { // this is the flag that gets set to true if parent dir(s) dont exist, i saw this from experience

					makeDirs();
				} else {
					deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); //throw rejObj;
				}
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_initialAttempt', aCaught:aCaught};

				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj); // throw aCaught;
			}
		);
	};

	if (!aOptions.causesNeutering) {
		doInitialAttempt();
	} else {
		// ensure dir exists, if it doesnt then go to makeDirs
		popToDir();
		var promise_checkDirExistsFirstAsCausesNeutering = OS.File.exists(toDir);
		promise_checkDirExistsFirstAsCausesNeutering.then(
			function(aVal) {

				// start - do stuff here - promise_checkDirExistsFirstAsCausesNeutering
				if (!aVal) {
					makeDirs();
				} else {
					doInitialAttempt(); // this will never fail as we verified this folder exists
				}
				// end - do stuff here - promise_checkDirExistsFirstAsCausesNeutering
			},
			function(aReason) {
				var rejObj = {name:'promise_checkDirExistsFirstAsCausesNeutering', aReason:aReason};

				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj);
			}
		).catch(
			function(aCaught) {
				var rejObj = {name:'promise_checkDirExistsFirstAsCausesNeutering', aCaught:aCaught};

				deferred_tryOsFile_ifDirsNoExistMakeThenRetry.reject(rejObj);
			}
		);
	}


	return deferred_tryOsFile_ifDirsNoExistMakeThenRetry.promise;
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
function xhr(aStr, aOptions={}) {
	// update 082115 - was not listening to timeout event, added that in
	// update on 082015 - fixed that aTimeout was not setting right
	// update 072615 - added support for aOptions.aMethod
	// currently only setup to support GET and POST
	// does an async request
	// aStr is either a string of a FileURI such as `OS.Path.toFileURI(OS.Path.join(OS.Constants.Path.desktopDir, 'test.png'));` or a URL such as `http://github.com/wet-boew/wet-boew/archive/master.zip`
	// Returns a promise
		// resolves with xhr object
		// rejects with object holding property "xhr" which holds the xhr object

	/*** aOptions
	{
		aLoadFlags: flags, // https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/NsIRequest#Constants
		aTiemout: integer (ms)
		isBackgroundReq: boolean, // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest#Non-standard_properties
		aResponseType: string, // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest#Browser_Compatibility
		aPostData: string
	}
	*/

	var aOptions_DEFAULT = {
		aLoadFlags: Ci.nsIRequest.LOAD_ANONYMOUS | Ci.nsIRequest.LOAD_BYPASS_CACHE | Ci.nsIRequest.INHIBIT_PERSISTENT_CACHING,
		aPostData: null,
		aResponseType: 'text',
		isBackgroundReq: true, // If true, no load group is associated with the request, and security dialogs are prevented from being shown to the user
		aTimeout: 0, // 0 means never timeout, value is in milliseconds
		Headers: null
	}

	for (var opt in aOptions_DEFAULT) {
		if (!(opt in aOptions)) {
			aOptions[opt] = aOptions_DEFAULT[opt];
		}
	}

	// Note: When using XMLHttpRequest to access a file:// URL the request.status is not properly set to 200 to indicate success. In such cases, request.readyState == 4, request.status == 0 and request.response will evaluate to true.

	var deferredMain_xhr = new Deferred();

	var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

	var handler = ev => {
		evf(m => xhr.removeEventListener(m, handler, !1));

		switch (ev.type) {
			case 'load':

					if (xhr.readyState == 4) {
						if (xhr.status == 200) {
							deferredMain_xhr.resolve(xhr);
						} else {
							var rejObj = {
								name: 'deferredMain_xhr.promise',
								aReason: 'Load Not Success', // loaded but status is not success status
								xhr: xhr,
								message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
							};
							deferredMain_xhr.reject(rejObj);
						}
					} else if (xhr.readyState == 0) {
						var uritest = Services.io.newURI(aStr, null, null);
						if (uritest.schemeIs('file')) {
							deferredMain_xhr.resolve(xhr);
						} else {
							var rejObj = {
								name: 'deferredMain_xhr.promise',
								aReason: 'Load Failed', // didnt even load
								xhr: xhr,
								message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
							};
							deferredMain_xhr.reject(rejObj);
						}
					}

				break;
			case 'abort':
			case 'error':
			case 'timeout':

					var rejObj = {
						name: 'deferredMain_xhr.promise',
						aReason: ev.type[0].toUpperCase() + ev.type.substr(1),
						xhr: xhr,
						message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
					};
					deferredMain_xhr.reject(rejObj);

				break;
			default:
				var rejObj = {
					name: 'deferredMain_xhr.promise',
					aReason: 'Unknown',
					xhr: xhr,
					message: xhr.statusText + ' [' + ev.type + ':' + xhr.status + ']'
				};
				deferredMain_xhr.reject(rejObj);
		}
	};

	var evf = f => ['load', 'error', 'abort', 'timeout'].forEach(f);
	evf(m => xhr.addEventListener(m, handler, false));

	if (aOptions.isBackgroundReq) {
		xhr.mozBackgroundRequest = true;
	}

	if (aOptions.aTimeout) {

		xhr.timeout = aOptions.aTimeout;
	}

	var do_setHeaders = function() {
		if (aOptions.Headers) {
			for (var h in aOptions.Headers) {
				xhr.setRequestHeader(h, aOptions.Headers[h]);
			}
		}
	};

	if (aOptions.aPostData) {
		xhr.open('POST', aStr, true);
		do_setHeaders();
		xhr.channel.loadFlags |= aOptions.aLoadFlags;
		xhr.responseType = aOptions.aResponseType;

		/*
		var aFormData = Cc['@mozilla.org/files/formdata;1'].createInstance(Ci.nsIDOMFormData);
		for (var pd in aOptions.aPostData) {
			aFormData.append(pd, aOptions.aPostData[pd]);
		}
		xhr.send(aFormData);
		*/
		var aPostStr = [];
		for (var pd in aOptions.aPostData) {
			aPostStr.push(pd + '=' + encodeURIComponent(aOptions.aPostData[pd])); // :todo: figure out if should encodeURIComponent `pd` also figure out if encodeURIComponent is the right way to do this
		}

		xhr.send(aPostStr.join('&'));
	} else {
		xhr.open(aOptions.aMethod ? aOptions.aMethod : 'GET', aStr, true);
		do_setHeaders();
		xhr.channel.loadFlags |= aOptions.aLoadFlags;
		xhr.responseType = aOptions.aResponseType;
		xhr.send(null);
	}

	return deferredMain_xhr.promise;
}
// end - common helper functions
