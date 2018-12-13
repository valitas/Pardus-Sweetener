
(function() {
	'use strict';
	var ukey = Universe.getServer ( document ).substr( 0, 1 );	
	var premium = true, missions, missionDiv = document.getElementById( 'missions' );
    
	if ( !missionDiv ) {
        premium = false;
    }
	
    if ( premium ) {
        missions = missionDiv.getElementsByTagName( 'tbody' )[0].childNodes;
    } else {
        missions = document.getElementById( 'div_missions' ).getElementsByTagName( 'table' );
    }

	chrome.storage.local.get( [ ukey + 'mlist' ], Mission.clearMissionStorage );

	// chrome.storage.local.remove( 
	var saveData = {}
	saveData[ ukey + 'mlist' ] = [];
	
	for( var i = 0; i < missions.length; i++ ) {
		if ( !premium && i % 2 === 1 ) { continue; }
		if ( premium && i === 0 ) { continue; }
		
		var mission = Mission.parseMission( missions[ i ], premium, false );
		// console.log( mission )
		if ( saveData[ ukey + 'mlist' ].includes( ukey + 'm' + mission.locId ) ) {
			//got one already, let's add it.
		} else {
			// new mission
			mission.total = 1;
			saveData[ ukey + 'm' + mission.locId ] = mission;	
			saveData[ ukey + 'mlist' ].push( ukey + 'm' + mission.locId );
		}
	}
	console.log( saveData );
	chrome.storage.local.set( saveData );

}());