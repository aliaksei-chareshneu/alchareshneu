# Kratke video pro INIZIO (osobni vysvetleni uchazece)

Text neni urcen ke strojovemu cteni. Ukazte skutecnou aplikaci a vlastnimi slovy vysvetlete jeji fungovani. Doporucena delka: 90-150 sekund. Video musi byt vasi nahravkou, nikoliv predstiranou nahravkou od AI.

## Osnova nahravani

**00:00-00:20: Uzivatelska cast**
"Dobry den, v ramci zadani jsem pripravil jednoduchou webovou stranku s jedinym vyhledavacim polem. Zadam konkretni slovni spojeni a dostanu organicke vysledky z prvni stranky Googlu."

**00:20-00:40: Vysledky + JSON**
[Vyhledejte treba `historie Brna` a kliknete na `Stahnout JSON`. Otevrete stazeny soubor.]
"Kazdy zaznam obsahuje pozici, titulek, URL a kratky popis; cele se to uklada jako strukturovany JSON. Reklamy se do souboru nezahrnuji."

**00:40-01:10: Architektura**
[Ukazte `search.js` a `server.js`.]
"Frontend odesle dotaz na moje backendove API. Server vyuziva Serper jako poskytovatele dat pro vysledky Googlu. Z jeho odpovedi vybiram jen pole `organic`, validuji odkazy a odfiltruji duplicity. API klic zustava na serveru; v prohlizeci neni."

**01:10-01:30: Testy**
[V terminalu spustte `npm test` a ukazte zeleny vysledek.]
"Automaticke testy kontroluji vysledny format, vynechani reklam, validaci vstupu, omezeni poctu pozadavku a chovani API."

**01:30-01:50: Co je dulezite vedet**
"Pro jednoduche spusteni je prilozen Docker Compose. Tento prototyp pouziva kratkou cache a omezeni dotazu, aby zbytecne necerpal API kredit. Pomahal jsem si AI nastroji, ale aplikaci jsem testoval a rozumim architekture."

## Pred odeslanim

- Spuste aplikaci s opravdovym klicem a zkuste tri dotazy (CZ + EN + nesmysl).
- Ukazte zeleny beh `npm test` (ocekavano 16/16).
- Overte, ze v exportu neni `ads` ani placeny vysledek.
- Zaznam ze screen recorderu dejte na odkaz, ktery funguje bez prihlaseni (overte v anonymnim okne).
- Neverejne udaje, emaily ani skutecny API klic ve videu nezobrazujte.
