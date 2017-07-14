(function() {
    'use strict';
    var hunted = ['Archimedes','Kahldar','Yarawath','Lucky'];
    var onlineplayers = parseInt(document.getElementsByTagName('p')[0].innerHTML.split(' ')[3]);
    var cells = document.getElementsByTagName('table')[6].getElementsByTagName('td');
    var names = [];
    for (var i=0; i<onlineplayers; i++) {
        for (var j = 0; j < hunted.length; j++) {
            if (cells[i].firstChild.innerHTML == hunted[j]) {
                cells[i].setAttribute("bgcolor", "red");
            }
        }
    }
})();