
(function( Mission ) {
    'use strict';
	

	// check if mission save feature is enabled by user.
	var config, cs = new ConfigurationSet();
	cs.addKey( 'missionDisplay' );
	config = cs.makeTracker( applyMissionStorage );
		
	function applyMissionStorage() {
		if( !config.missionDisplay )
			return;
		
		var ukey = Universe.getServer ( document ).substr( 0, 1 );	
		var premium = true, missions;
		
		var missionDiv = document.getElementById( 'missions' );
		if ( !missionDiv ) {
			premium = false;
		}
		if ( premium ) {
			missions = missionDiv.getElementsByTagName( 'tbody' )[0].childNodes;
		} else {
			missions = document.getElementById( 'div_missions' ).getElementsByTagName( 'table' );
		}

        var obsConfig = { attributes: true, childList: true, subtree: true };

        for( var i = 0; i < missions.length; i++) {
			if ( !premium && i % 2 === 1 ) { continue; }
			if ( premium && i === 0 ) { continue; }
            
            var obs = new MutationObserver( clickedMission.bind( missions[i], premium ) );
				
			// let a = missions[i].getElementsByTagName( 'a' );		
			// a[ a.length - 1 ].addEventListener( 'click', clickedMission.bind( missions[i], premium ) );
            let divs = missions[ i ].getElementsByTagName( 'div' );
            obs.observe( divs[ divs.length - 1], obsConfig );
		}

		function clickedMission( premium, mutationList, observer ) {
			if ( this.getElementsByTagName( 'div' )[ this
                .getElementsByTagName('div').length - 1].textContent 
                == 'NOT OFFERED' ) {
                    return;
                }
            
            var mission = Mission.parseMission( this, premium, true );
			let get = [ ukey + 'm' + mission.locId, ukey + 'mlist' ];
			chrome.storage.local.get( get, storeMission.bind( null, mission ) );
		}
		
		function storeMission( mission, data ) {
			data = Mission.updateMission( mission, data );
			chrome.storage.local.set( data );
		}
			
		
	}
})( Mission );