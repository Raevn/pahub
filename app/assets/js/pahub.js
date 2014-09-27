var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');

var constant = {};

function init() {
	initPlatform();
	loadConfig();
}

function initPlatform() {
	var platform = "";
	pahub.api.log.addLogMessage("info", "Detected architecture: " + process.arch);
	pahub.api.log.addLogMessage("info", "Detected platform: " + process.platform);
	
	switch (process.platform) {
		case 'win32': // Windows
			setConstant("PA_DATA_DIR", path.join(process.env.USERPROFILE, "appdata/local/Uber Entertainment/Planetary Annihilation"));
			break;
		case 'linux': // Linux
			//TODO
			//setConstant("PA_DATA_DIR", path.join('', '')); 
			break;
		case 'darwin': // Mac OSX
			//TODO
			//setConstant("PA_DATA_DIR", path.join('', '')); 
			break;
	}
	
	setConstant("PAHUB_BASE_DIR", path.normalize(process.cwd()));
	
	if (fs.existsSync(constant.PA_DATA_DIR) == false) {
		pahub.api.log.addLogMessage("verb", "PA_DATA_DIR folder not found, generating");
		mkdirp.sync(constant.PA_DATA_DIR);
	}
		
	setConstant("PAHUB_CONTENT_DIR", path.join(constant.PA_DATA_DIR, "pahub/content"));
	if (fs.existsSync(constant.PAHUB_CONTENT_DIR) == false) {
		pahub.api.log.addLogMessage("verb", "PAHUB_CONTENT_DIR folder not found, generating");
		mkdirp.sync(constant.PAHUB_CONTENT_DIR);
	}
	
	setConstant("PAHUB_PLUGIN_DIR", path.join(constant.PA_DATA_DIR, "pahub/content/plugin"));
	if (fs.existsSync(constant.PAHUB_PLUGIN_DIR) == false) {
		pahub.api.log.addLogMessage("verb", "PAHUB_PLUGIN_DIR folder not found, generating");
		mkdirp.sync(constant.PAHUB_PLUGIN_DIR);
	}
	
	setConstant("PAHUB_DATA_DIR", path.join(constant.PA_DATA_DIR, "pahub/data"));
	if (fs.existsSync(constant.PAHUB_DATA_DIR) == false) {
		pahub.api.log.addLogMessage("verb", "PA_DATA_DIR folder not found, generating");
		mkdirp.sync(constant.PAHUB_DATA_DIR);
	}
	
	setConstant("PAHUB_CACHE_DIR", path.join(constant.PA_DATA_DIR, "pahub/cache"));
	if (fs.existsSync(constant.PAHUB_CACHE_DIR) == false) {
		pahub.api.log.addLogMessage("verb", "PAHUB_CACHE_DIR folder not found, generating");
		mkdirp.sync(constant.PAHUB_CACHE_DIR);
	}
	
	setConstant("PAHUB_CONFIG_FILE", path.join(constant.PA_DATA_DIR, "pahub/pahub-config.json"));
	if (fs.existsSync(constant.PAHUB_CONFIG_FILE) == false) {
		pahub.api.log.addLogMessage("verb", "pahug-config.json file not found, generating");
		writeJSONtoFile(constant.PAHUB_CONFIG_FILE, {			
			"plugins_core": [
				"com.pahub.content.plugin.contenthub",
				"com.pahub.content.plugin.store.plugin"
			]
		});
	}
	
	setConstant("PAHUB_LOG_FILE", path.join(constant.PA_DATA_DIR, "pahub/pahub-log.txt"));
	pahub.api.log.writeLog();
}

//parses pahub-config.json, and loads core plugins
function loadConfig() {
	pahub.api.log.addLogMessage("info", "Loading PAHUB config file");
	var config = readJSONfromFile(constant.PAHUB_CONFIG_FILE);
	
	if (config != false) {
		if (config.hasOwnProperty("plugins_core") == true) {
			if ($.isArray(config.plugins_core)) {
				for(var i = 0; i < config.plugins_core.length; i++) {
					pahub.api.log.addLogMessage("info", "Core plugin: '" + config.plugins_core[i] + "'");
				}
				for(var i = 0; i < config.plugins_core.length; i++) {
					pahub.api.plugin.loadPlugin(path.join(constant.PAHUB_PLUGIN_DIR, config.plugins_core[i]), function(plugin) {
						plugin.enabled = true;
						model.core_plugins.push(plugin);
						pahub.api.log.addLogMessage("info", "Core plugin '" + plugin.content_id + "': enabled");
					});
				}
			} else {
				pahub.api.log.addLogMessage("error", "Error processing PAHUB config file: 'plugins_core' not an array");
			}
		}
	}
}

function setConstant(key, value) {
	constant[key] = value;
	pahub.api.log.addLogMessage("verb", key + ": " + constant[key]);
}

// getMapItemIndex(object, attribute, itemValue)
// returns the index of object where attribute has the value itemValue
// returns -1 if object is not an object, or if no item in object has an attribute with value itemValue
function getMapItemIndex(object, attribute, itemValue) {
	if (typeof object === 'object') {
		var i = 0;
		var length = object.length;
		for (i = 0; i < length; i++) {
			value = object[i];
			if (value[attribute] == itemValue) {
				return i;
			}
		}
	} else {
		pahub.api.log.addLogMessage("error", "Invalid call to getMapItemIndex: Parameter 'object' not an object");
	}
	return -1;
}

function getSubFolders(folder) {
	folder = path.normalize(folder);
	if (fs.existsSync(folder) == true) {
		if( fs.statSync(folder).isDirectory() == true) {
			return fs.readdirSync(folder).filter(function (file) {
				return fs.statSync(path.join(folder, file)).isDirectory();
			});
		} else {
			pahub.api.log.addLogMessage("error", "Error opening '" + folder + "': Not a folder");
		}
	} else {
		pahub.api.log.addLogMessage("error", "Error opening '" + folder + "': Folder not found");
	}
}

function getSafeString(text) {
	var key = text.replace(" ", "_") || false;
	//TODO: Better sanitization
	return key;
}

function createLocKey(text) {
	return getSafeString(text);
}

function writeJSONtoFile(file, data) {
	writeToFile(file, JSON.stringify(data, null, 4).replace(/\r?\n/g, "\r\n"));
}

function writeToFile(file, data) {
	pahub.api.log.addLogMessage("verb", "Writing to file");
	pahub.api.log.addLogMessage("verb", "Path: " + getShortPathString(file));
	try {
		fs.writeFileSync(file, data);
		return true;
	} catch(err) {
		pahub.api.log.addLogMessage("error", "Error writing to file: " + err);
		pahub.api.log.addLogMessage("error", "Path: " + getShortPathString(file));
		return false;
	}
}

function appendToFile(file, data) {
	//can't include logging here
	try {
		fs.appendFileSync(file, data);
		return true;
	} catch(err) {
		return false;
	}
}

//Turns a long file path into a shorter one by substituting known folders for tags like <PAHUB_PLUGIN_DIR>.
//Useful for logging
function getShortPathString(url) {
	var short_path = path.normalize(url)
		.replace(constant.PAHUB_PLUGIN_DIR, "<PAHUB_PLUGIN_DIR>")
		.replace(constant.PAHUB_CONTENT_DIR, "<PAHUB_CONTENT_DIR>")
		.replace(constant.PAHUB_DATA_DIR, "<PAHUB_DATA_DIR>")
		.replace(constant.PAHUB_CACHE_DIR, "<PAHUB_CACHE_DIR>")
		.replace(constant.PA_DATA_DIR, "<PA_DATA_DIR>");
	
	return short_path;
}

//Same as readFromFile, except it attempts to parse the result as a JSON object.
function readJSONfromFile(file) {
	var result = readFromFile(file);
	if (result != false) {
		try {
			var resultJSON = JSON.parse(result);
			return resultJSON;
		} catch (err) {
			pahub.api.log.addLogMessage("error", "Error parsing JSON data: " + err);
			return false;
		}
	} else {
		return false;
	}
}

function readFromFile(file) {
	if (fs.existsSync(path.normalize(file)) == true) {
		pahub.api.log.addLogMessage("verb", "Loading file");
		pahub.api.log.addLogMessage("verb", "Path: " + getShortPathString(file));
		try {
			var readFile = fs.readFileSync(path.normalize(file));
			return readFile;
		} catch (err) {
			pahub.api.log.addLogMessage("error", "Error loading file: " + err);
			pahub.api.log.addLogMessage("error", "Path: " + getShortPathString(file));
			return false;
		}
	} else {
		pahub.api.log.addLogMessage("error", "Error loading file: File not found");
		pahub.api.log.addLogMessage("error", "Path: " + getShortPathString(file));
		return false;
	}
}

function getFileSizeString(size) {
	var suffix = "B";
	if (size >= 1024) {
		suffix = "KB";
		size /= 1024;
	}
	if (size >= 1024) {
		suffix = "MB";
		size /= 1024;
	}
	if (size >= 1024) {
		suffix = "GB";
		size /= 1024;
	}
	if (size >= 1024) {
		suffix = "TB";
		size /= 1024;
	}
	return parseFloat(size).toFixed(2) + suffix;
}

//converts a date/time object in HH:MM:SS.MMM
function getTimeString(time) {
	function pad10(n) {
		return n < 10 ? '0' + n : n;
	}
	function pad100(n) {
		return n < 10 ? '00' + n : (n < 100 ? '0' + n : n);
	}
	
	return pad10(time.getHours()) + ":" + pad10(time.getMinutes()) + ":" + pad10(time.getSeconds()) + "." + pad100(time.getMilliseconds());
}

