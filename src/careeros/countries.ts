const COUNTRY_CODES = [
  "AD","AE","AF","AG","AI","AL","AM","AO","AQ","AR","AS","AT","AU","AW","AX","AZ","BA","BB","BD","BE","BF","BG","BH","BI","BJ","BL","BM","BN","BO","BQ","BR","BS","BT","BV","BW","BY","BZ","CA","CC","CD","CF","CG","CH","CI","CK","CL","CM","CN","CO","CR","CU","CV","CW","CX","CY","CZ","DE","DJ","DK","DM","DO","DZ","EC","EE","EG","EH","ER","ES","ET","FI","FJ","FK","FM","FO","FR","GA","GB","GD","GE","GF","GG","GH","GI","GL","GM","GN","GP","GQ","GR","GS","GT","GU","GW","GY","HK","HM","HN","HR","HT","HU","ID","IE","IL","IM","IN","IO","IQ","IR","IS","IT","JE","JM","JO","JP","KE","KG","KH","KI","KM","KN","KP","KR","KW","KY","KZ","LA","LB","LC","LI","LK","LR","LS","LT","LU","LV","LY","MA","MC","MD","ME","MF","MG","MH","MK","ML","MM","MN","MO","MP","MQ","MR","MS","MT","MU","MV","MW","MX","MY","MZ","NA","NC","NE","NF","NG","NI","NL","NO","NP","NR","NU","NZ","OM","PA","PE","PF","PG","PH","PK","PL","PM","PN","PR","PS","PT","PW","PY","QA","RE","RO","RS","RU","RW","SA","SB","SC","SD","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","SS","ST","SV","SX","SY","SZ","TC","TD","TF","TG","TH","TJ","TK","TL","TM","TN","TO","TR","TT","TV","TW","TZ","UA","UG","UM","US","UY","UZ","VA","VC","VE","VG","VI","VN","VU","WF","WS","YE","YT","ZA","ZM","ZW"
] as const;

const CURRENCY_BY_COUNTRY: Record<string,string> = {
  AE:"AED",AU:"AUD",CA:"CAD",CH:"CHF",CN:"CNY",CZ:"CZK",DE:"EUR",DK:"DKK",ES:"EUR",FI:"EUR",FR:"EUR",GB:"GBP",HK:"HKD",HU:"HUF",ID:"IDR",IE:"EUR",IL:"ILS",IN:"INR",IT:"EUR",JP:"JPY",KR:"KRW",MX:"MXN",MY:"MYR",NL:"EUR",NO:"NOK",NZ:"NZD",PH:"PHP",PL:"PLN",PT:"EUR",QA:"QAR",RO:"RON",SA:"SAR",SE:"SEK",SG:"SGD",TH:"THB",TR:"TRY",TW:"TWD",US:"USD",VN:"VND",ZA:"ZAR"
};

export function flagForCountry(code:string){
  return code.toUpperCase().replace(/./g,char=>String.fromCodePoint(127397+char.charCodeAt(0)));
}

export function buildCountryOptions(locale = "en"){
  const names = typeof Intl !== "undefined" && Intl.DisplayNames ? new Intl.DisplayNames([locale],{type:"region"}) : null;
  return COUNTRY_CODES.map(code=>({
    code,
    name:names?.of(code) || code,
    flag:flagForCountry(code),
    currency:CURRENCY_BY_COUNTRY[code] || null,
  })).sort((a,b)=>a.name.localeCompare(b.name));
}

export { COUNTRY_CODES };
