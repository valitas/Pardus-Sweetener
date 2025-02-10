
(function() {
	'use strict';
	// check if mission save feature is enabled by user.
	var config, cs = new ConfigurationSet();
	cs.addKey( 'missionDisplay' );
	config = cs.makeTracker( parseJobs );
		
	function parseJobs() {
		if( !config.missionDisplay )
			return;

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
        
        if( document.evaluate( '//a[starts-with(text(),"Missions (0)")]', 
            document, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null )
            .singleNodeValue ) {
            // Missions (0) exists, so no missions. Let's clear our data.
            let saveData = {};
            saveData[ ukey + 'mlist' ] = [];
            chrome.storage.local.set( saveData );
        }
        
		if ( document.getElementById('div_missions').style.display == 'none' )
			return
			// We're in tasks. Abort! 

		chrome.storage.local.get( [ ukey + 'mlist' ], Mission.clearMissionStorage.bind( null, onStorageClear ) );

		function onStorageClear() {
            var saveData = {}
            
            for( var i = 0; i < missions.length; i++ ) {
                if ( !premium && i % 2 === 0 ) { continue; }
                if ( premium && i === 0 ) { continue; }
                
                var mission = Mission.parseMission( missions[ i ], premium, false );
                saveData = Mission.updateMission( mission, saveData );

                }
            chrome.storage.local.set( saveData );
		}
	}
}());