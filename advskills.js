'use strict';

(function() {
	// Grabs levels of adv. combat and general skills and puts them into the storage.
	
	var XPATH_LEVELTH = document.createExpression(
		'//table//th[starts-with(text(),"Level")]',
		null );
	
	var levelTh = XPATH_LEVELTH.evaluate(
				document.body,
				XPathResult.ORDERED_NODE_ITERATOR_TYPE,
				null
			);
	var level = levelTh.iterateNext();
	var advSkills = [];
	while( level ) {
		let levelText = level.textContent.split(/[\/ ]/g);
		advSkills.push( parseInt(levelText[1]) );		
		level = levelTh.iterateNext();
	}
	let toSave = {};
	var universe = Universe.getServer( document );
	toSave[ universe + 'advSkills'] = advSkills;
	chrome.storage.local.set( toSave );
	/* Yes it's an array, if the table wasn't a coding crime, I would've made it a dictionary. 
	But here's the list:
	0	Combat Mastery 
	1	Ambush Mastery
	2	Weapon Mastery
	3	Chronoton Collection
	4	Boosts
	5	Combat Efficiency
	6	Offensive Combat
	7	Defensive Combat
	8	Ambush Endur.
	9	Ambush Fallback
	10	C Weapon Spec.
	11	EM Weap. Spec.
	12	O Weapon Spec.
	13	Tbomb I Constr.
	14	Tbomb II Constr.
	15	Agility Boost 
	16	Taming Boost
	17	Cloaking Boost
	18	Structure Mastery
	19	Underground Trade
	20	Hack Mastery
	21	Meditation
	22	Mercenarism
	23	Shield Charging
	24	Shield Powering
	25	Hull Fortific.
	26	Sneakiness
	27	Haggling
	28	Hack Effic.
	29	Echo Hack
	30	Trip Control
	31	Neural Eng.
	32	Efficient Dealm.
	33	Time Manag.
	34	Escorting
	35	Transport Pay Neg.
	36	Expertise
	37	Cargo Organization
	38	Orbiter Mastery
	39	Explosives Handling
	40	Advanced Mainten.
	41	Navigation
	42	Package Cluster.
	43	Packing Mastery
	44	Leech Husbandry
	45	Drone Efficiency
	46	Parasite Detection
    */
	
})();