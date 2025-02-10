(function() {
	'use strict';
	chrome.storage.local.get( [ Universe.getName( document )[0] + 'loc', Universe.getServer ( document ).substr( 0, 1 ) + 'mlist' ] , Mission.removeMission );
})();