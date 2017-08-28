var i18n = require('./../localizator');
var sender = require('./../sender');
var messageKeys = require('message_keys');
isForecast = false;

exports.getWeather = function(type) {  
  var success = type === 'forecast' ? locationForecast : locationSuccess;  

  return navigator.geolocation.getCurrentPosition(
    success,
    locationError,
    {timeout: 5000, maximumAge: 0}
    );
};


function getWeatherAPIKey() {
	return localStorage.getItem('clay-settings') ?
		JSON.parse(localStorage.getItem('clay-settings')).WeatherAPIKey :
		"not_set";
	}

function getTempUnits() {
  var units = JSON.parse(localStorage.getItem('clay-settings')).WeatherUnits;
  switch (units) {
    case 'imperial':
      return '&units=imperial';
    case 'metric':
      return '&units=metric';
    case 'default':
      return '';
    default:
      return '';
  }
}

function xhrRequest (url, type, callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function () {
    callback(this.responseText);
  };
  xhr.open(type, url);
  xhr.send();
}

function sendWeather(weather_data) {
    sender.send(weather_data);
}

function isDayNow (sunrise, sunset) {
  if(!sunrise) {
    return true;
  }
  var now = Date.now() / 1000;
  return now > sunrise && now < sunset;
}

function getWindDirection(direction) {
  var directions = ['o', 'p', 'q', 'r', 'k', 'l', 'm', 'n']; 
  var sector = Math.round(direction / 45);
  return sector !== 8 ? directions[sector] : directions[0]; 
}

function addLeadingZero(num) {
  return num > 9 ? num : '0' + num;
}

function timeFromUtc (utc) {
  var offset = new Date().getTimezoneOffset();  
  return new Date(utc * 1000  + offset * 60);
}

function getDateTimeStr(utc) {
  var time = timeFromUtc(utc);
  var date = addLeadingZero(time.getDate())+"."+addLeadingZero(time.getMonth() + 1);
  return date + " " + getTimeStr(utc);
}


function getTimeStr(utc) {  
  var time = timeFromUtc(utc);
  return addLeadingZero(time.getHours())+":"+addLeadingZero(time.getMinutes());
}

function locationForecast(pos) {
  isForecast = true;
  locationSuccess(pos);
}

function getRequestType() {
  return isForecast ? 'forecast' : 'weather';
}

function saveForecast(json) {
  var storageName = 'forecast';
  //localStorage.setItem(storageName, json);
  //console.log('forecast saved:'+JSON.parse(localStorage.getItem(storageName)));
}

function fillForecastData(data, fill_obj, index, json) {
    var keys = Object.keys(fill_obj);
    keys.forEach(function(key) {
      var val = fill_obj[key];
      var item_data = key.split('.').reduce(function (acc,item) {
          return acc[item];
        }, json);
      data[val + index] = processItemDispatcher(key, item_data);

    });
    return data;
}

function processForecast(parsed) {

  var forecast_matrix = [0, 2, 4, 6];

  var weather_data = {
     "WeatherMarkerForecast": true,
     "ForecastQty": forecast_matrix.length,
     "ForecastTime": parsed.list[0].dt
  };
  var fill_obj = {
    'main.temp': messageKeys['ForecastTemperature'],
    'weather.0.id': messageKeys['ForecastCondition'],
    'dt' : messageKeys['ForecastTimeStamp']
  };
  
  forecast_matrix.forEach(function(value, index) {
    fillForecastData(weather_data, fill_obj,
                    index, parsed.list[value]);

  });
  return weather_data;
}

function processItemDispatcher(item_key, item_data) {
  switch (item_key) {
    case 'dt': 
      return processItemDateTime(item_data);
    case 'weather.0.id':
      return getCondition(item_data);
    default: 
      return item_data;    
  }
}

function processItemDateTime(item) {
  return getDateTimeStr(item + 60);
  //59 min looks ugly, add one more minute
}

function parseResponse(json) {
  var weatherData = isForecast ? 
    processForecast(json) :    
    {
     "WeatherMarker": true,
     "WeatherTemperature": json.main.temp,
     "WeatherCondition": getCondition(json.weather[0].id, json.sys.sunrise, json.sys.sunset),
     "WeatherDesc": json.weather[0].description,
     "WeatherTimeStamp": json.dt,
     "WeatherPressure": Math.round(json.main.pressure * 0.75) - 14,
     "WeatherWindSpeed": json.wind.speed,
     "WeatherWindDirection": getWindDirection(json.wind.deg),
     "WeatherHumidity": json.main.humidity,
     "WeatherSunrise": getTimeStr(json.sys.sunrise),
     "WeatherSunset": getTimeStr(json.sys.sunset)
    };

    sendWeather(weatherData);
}

function locationSuccess(pos) {
  // We will request the weather here
  var weatherAPIKey = getWeatherAPIKey();
//  return;
   if (weatherAPIKey == "not_set" || weatherAPIKey == "invalid_api_key" ) {
     console.log("Weather ERROR: Invalid API key");
     return ;
   }

  var url = 'http://api.openweathermap.org/data/2.5/'+getRequestType()+'?lat=' +
      pos.coords.latitude +
      '&lon=' + pos.coords.longitude +
      '&lang=' + i18n.getLang() +
      getTempUnits() + 
      '&appid=' + weatherAPIKey;// + 'ru';
    return xhrRequest(url, 'GET',
    function(responseText) {
  //    fetchingWeather = false;
    // responseText contains a JSON object with weather info
    	var json = JSON.parse(responseText);

    	if (json.cod === 401) {
    		console.log("Waether ERROR: Invalid API key");
        return;
    	}
      parseResponse(json);
    }
  );
}

function locationError(err) {  
  return {
  	"WeatherError":"Error requesting location!"
  }
}

//http://openweathermap.org/weather-conditions
function getCondition (owmCond, sunrise, sunset) {
  var isDay = isDayNow(sunrise, sunset);
//Thunderstorm
  switch (owmCond) {
//    
    case 200:
    case 201:
    case 202:
      return '`';
    case 210:
    case 211:
    case 212:
    case 221:
      return 'F';
    case 230:
    case 231:
    case 232: 
      return '_';
//Drizzle
    case 300:
    case 301:
    case 302:
    case 310:
    case 311:
    case 312:
    case 313:
    case 314:
    case 321:
      return "'";
  // light rain
    case 500: 
      return "6";
  //moderate rain
    case 501:
      return '$';
  //heavy rain
    case 502:
    case 503:
    case 504:
      return 'a';
    case 511:
      return 's';    
    case 520:
    case 521:
    case 522:
    case 531:
      return '*';
    case 600:
    case 601:
    case 602:
    case 620:
    case 621:
    case 622:
      return 't';
    case 611:
    case 612:
    case 615:
    case 616:
      return 'u'; 
    case 700:
    case 741:
      return '?';
    case 711:
      return 'А';
    case 721:
      return '<';
    case 731:
    case 751:
      return '<';
    case 761:
      return 'Б';
//clear sky      
    case 800:
      return isDay ? 'I' : 'N';
    case 801:
      return isDay ? 'b' : '#';
    case 802:
      return isDay ? 'c' : '#';
    case 803:
      return isDay ? '"' : '#';
    case 804:
      return '!';
    default:
      return 'h';
  }
}