var mailto_services = [
	/*
	{
		handler_id:
		name:
		url_template:
		description:
		icon_dataurl:
		icon_imugr_url:
		color:
		group: 0 for popular, 1, for personal/discovered/custom/social, 2 for native like outlook
		update_time:
		installed: bool // user based field all others are from server
		active: bool // user based field all others are from server
	}
	*/
	{
		handler_id: 1,
		name: 'AIM Mail',
		url_template: 'http://webmail.aol.com/Mail/ComposeMessage.aspx?to=%s',
		description: 'This handles both AOL Mail and AIM Mail',
		icon_dataurl: 'chrome://mailtowebmails/content/resources/images/logo-aolmail.png',
		icon_imugr_url: null,
		color: 'rgb(255, 204, 0)',
		group: 0,
		update_time: 0,
		installed: false,
		active: false
	},
	{
		handler_id: 2,
		name: 'FastMail',
		url_template: 'https://www.fastmail.com/action/compose/?mailto=%s',
		description: 'Handles the light weight FM service',
		icon_dataurl: 'chrome://mailtowebmails/content/resources/images/logo-fastmail.png',
		icon_imugr_url: null,
		color: 'rgb(68, 86, 127)',
		group: 1,
		update_time: 1,
		installed: false,
		active: false
	},
	{
		handler_id: 3,
		name: 'GMail',
		url_template: 'https://mail.google.com/mail/?extsrc=mailto&url=%s',
		description: 'The GMail handler comes installed by default with Firefox',
		icon_dataurl: 'chrome://mailtowebmails/content/resources/images/logo-gmail2.png',
		icon_imugr_url: null,
		color: 'rgb(235, 42, 46)',
		group: 0,
		update_time: 0,
		installed: false,
		active: false
	},
	/*
	{
		handler_id: 4,
		name: 'Lycos Mail',
		url_template: '????????????',
		description: 'Handles the popular Lycos webmail client',
		icon_dataurl: 'chrome://mailtowebmails/content/resources/images/logo-lycos.png',
		icon_imugr_url: null,
		color: 'rgb(68, 86, 127)',
		group: 1,
		update_time: 0,
		installed: false,
		active: false
	},
	*/
	{
		handler_id: 5,
		name: 'Outlook Live',
		url_template: 'https://mail.live.com/secure/start?action=compose&to=%s', //chrome mailto ext uses: `https://mail.live.com/default.aspx?rru=compose&to={to}&subject={subject}&body={body}&cc={cc}`
		description: 'Service also for Hotmail and Live Mail',
		icon_dataurl: 'chrome://mailtowebmails/content/resources/images/logo-outlook.png',
		icon_imugr_url: null,
		color: 'rgb(0, 115, 198)',
		group: 0,
		update_time: 0,
		installed: false,
		active: false
	},
	{
		handler_id: 6,
		name: 'QQ邮箱 (QQMail)',
		url_template: 'https://mail.google.com/mail/?extsrc=mailto&url=%s',
		description: '常联系!',
		icon_dataurl: 'chrome://mailtowebmails/content/resources/images/logo-qq.png',
		icon_imugr_url: null,
		color: 'rgb(255, 102, 0)',
		group: 0,
		update_time: 0,
		installed: false,
		active: false
	},
	{
		handler_id: 7,
		name: 'Yahoo Mail',
		url_template: 'https://compose.mail.yahoo.com/?To=%s',
		description: 'Handles the light weight FM service',
		icon_dataurl: 'chrome://mailtowebmails/content/resources/images/logo-y!mail3.png',
		icon_imugr_url: null,
		color: 'rgb(65, 2, 143)',
		group: 0,
		update_time: 0,
		installed: false,
		active: false
	},
	{
		handler_id: 8,
		name: 'Yandex.Mail',
		url_template: 'https://mail.yandex.com/compose?mailto=%s',
		description: 'The largest search engine in Russia. Поиск информации в интернете с учетом русской морфологии!',
		icon_dataurl: 'chrome://mailtowebmails/content/resources/images/logo-yandex.png',
		icon_imugr_url: null,
		color: 'rgb(223, 78, 44)',
		group: 0,
		update_time: 0,
		installed: false,
		active: false
	},
	{
		handler_id: 9,
		name: 'ZOHO Mail',
		url_template: 'https://zmail.zoho.com/mail/compose.do?extsrc=mailto&mode=compose&tp=zb&ct=%s',
		description: 'Email designed with business users in mind',
		icon_dataurl: 'chrome://mailtowebmails/content/resources/images/logo-zoho.png',
		icon_imugr_url: null,
		color: 'rgb(36, 160, 68)',
		group: 1,
		update_time: 0,
		installed: false,
		active: false
	}
];

mailto_services.sort(function(a, b) {
	return a.name > b.name;
});

var ANG_APP = angular.module('mailtowebmails', [])
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

		$scope.trustSrc = function(src) {
			return $sce.trustAsResourceUrl(src);
		};
		
        var MODULE = this;
		
        MODULE.mailto_services = mailto_services;
		MODULE.editing_handler_id = 1;
		
		MODULE.toggle_active = function(aServiceEntry) {
			if (!aServiceEntry.active) {
				for (var i=0; i<MODULE.mailto_services.length; i++) {
					MODULE.mailto_services[i].active = false;
				}
				aServiceEntry.active = true;
			} else {
				aServiceEntry.active = false;
			}
		};

		MODULE.toggle_install = function(aServiceEntry) {
			// on uninstall, if it is discovered/custom/social/presonal
			aServiceEntry.installed = !aServiceEntry.installed;
			if (!aServiceEntry.installed) {
				aServiceEntry.active = false;
			}
		};
		
		MODULE.edit = function(aServiceEntry) {
			
		};
		
		MODULE.add = function() {
			
		};

        MODULE.info = function() {
            console.info(MODULE.mailto_services);
        };

		MODULE.info();
    }]);