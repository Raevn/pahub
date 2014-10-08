var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var JSZip = require('jszip');
var semver = require('semver');

var constant = {};

var pahubConfig = {};
var pahubPackage = {};

function init() {
	initPlatform();
	
	//TODO: change from master
	setConstant("PAHUB_PACKAGE_URL", "https://raw.githubusercontent.com/raevn/pahub/master/app/package.json");
	setConstant("PAHUB_UPDATE_URL", "https://github.com/raevn/pahub/archive/master.zip");
	loadPackage();
	loadConfig();
}

function initPlatform() {
	var platform = "";
	pahub.api.log.addLogMessage("info", "Detected architecture: " + process.arch);
	pahub.api.log.addLogMessage("info", "Detected platform: " + process.platform);

	switch (process.platform) {
		case 'win32': // Windows
			setConstant("PA_DATA_DIR", path.join(process.env.USERPROFILE, "appdata/local/Uber Entertainment/Planetary Annihilation"));
			setConstant("PAHUB_BASE_DIR", path.dirname(process.execPath));
			setConstant("PAHUB_PACKAGE_FILE", path.join(constant.PAHUB_BASE_DIR, "resources/app/package.json"));
			break;
		case 'linux': // Linux
			//TODO
			//setConstant("PA_DATA_DIR", path.join('', '')); 
			break;
		case 'darwin': // Mac OSX
			setConstant("PA_DATA_DIR", path.join(process.env.HOME, 'Library/Application Support/Uber Entertainment/Planetary Annihilation')); 
			// removing "MacOS/Atom Helper", leaving us at ..."Atom.app/Content"
			setConstant("PAHUB_BASE_DIR", path.normalize(path.join(process.execPath, '../..')));
			// ..."Atom.app/Content/Resources"
			setConstant("PAHUB_PACKAGE_FILE", path.join(process.resourcesPath, "app/package.json"));
			break;
	}
	
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

function loadPackage() {
	pahub.api.log.addLogMessage("verb", "Loading PAHUB package file");
	var packageJSON = readJSONfromFile(constant.PAHUB_PACKAGE_FILE);
	
	if (packageJSON != false) {
		pahubPackage = packageJSON;
	} else {
		//shouldn't ever get here.
	}
}

/**
 * Look ma, it's cp -R.
 * @param {string} src The path to the thing to copy.
 * @param {string} dest The path to the new copy.
 */
 // http://stackoverflow.com/questions/13786160/copy-folder-recursively-in-node-js
var copyRecursiveSync = function(src, dest) {
	var exists = fs.existsSync(src);
	var stats = exists && fs.statSync(src);
	var isDirectory = exists && stats.isDirectory();
	if (exists && isDirectory) {
		fs.mkdirSync(dest);
		fs.readdirSync(src).forEach(function(childItemName) {
			copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
		});
	} else {
		fs.linkSync(src, dest);
	}
};

//http://stackoverflow.com/questions/12627586/is-node-js-rmdir-recursive-will-it-work-on-non-empty-directories
deleteFolderRecursive = function(path) {
    var files = [];
    if( fs.existsSync(path) ) {
        files = fs.readdirSync(path);
        files.forEach(function(file,index){
            var curPath = path + "/" + file;
            if(fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

function getZippedFilePath(zip_source, file_name) {
	//check it's a zip file?
	if (fs.existsSync(path.normalize(zip_source)) == true) {
		var zipFile = readFromFile(zip_source);
		var zipObject = new JSZip(zipFile.toArrayBuffer());
        for(var fileName in zipObject.files) {
			if (path.basename(fileName) == file_name) {
				return path.dirname(fileName);
			}
		}
	}
	alert(fs.existsSync(path.normalize(zip_source)));
	return false;
}

function extractZip(source, folder, destination, subfolder) {
	//check it's a zip file?
	if (fs.existsSync(path.normalize(source)) == true) {
		
		var zipFile = readFromFile(source);
		var zipObject = new JSZip(zipFile.toArrayBuffer());

		if (fs.existsSync(path.join(constant.PAHUB_CACHE_DIR, folder)) == true) {
			deleteFolderRecursive(path.join(constant.PAHUB_CACHE_DIR, folder));
		}
		mkdirp.sync(path.join(constant.PAHUB_CACHE_DIR, folder));

		
        for(var fileName in zipObject.files) {
			var currentFile = zipObject.files[fileName];
			if (currentFile.options.dir == true) {
				if (subfolder == null || currentFile.name.indexOf(subfolder) == 0) {
					var folderPath = path.join(constant.PAHUB_CACHE_DIR, folder, subfolder ? currentFile.name.replace(subfolder, "") : currentFile.name);
												
					if (fs.existsSync(folderPath) == false) {
						mkdirp.sync(folderPath);
					}
				}
			} else {
				if (subfolder == null || currentFile.name.indexOf(subfolder) == 0) {
					var filePath = path.join(constant.PAHUB_CACHE_DIR, folder, subfolder ? currentFile.name.replace(subfolder, "") : currentFile.name);
					writeToFile(filePath, new Buffer(currentFile.asUint8Array()));
				}
			}
		}
		
		//do this via a "deleteContent" command, which uses the current content.url to determine where to delete
		//this overcomes the issue of old installed mods using theit own folder names instead of content ids.
		if (fs.existsSync(path.join(destination, folder)) == true) {
			//backup existing directory first
			deleteFolderRecursive(path.join(destination, folder));
		}
		copyRecursiveSync(path.join(constant.PAHUB_CACHE_DIR, folder), path.join(destination, folder));
		
		//cleanup
	}
}

//parses pahub-config.json, and loads core plugins
function loadConfig() {
	pahub.api.log.addLogMessage("verb", "Loading PAHUB config file");
	var configJSON = readJSONfromFile(constant.PAHUB_CONFIG_FILE);
	
	if (configJSON != false) {
		pahubConfig = configJSON;
		checkForUpdates();
		loadCorePlugins();
	} else {
		//error
	}
}

function checkForUpdates() {
	pahub.api.resource.loadResource(constant.PAHUB_PACKAGE_URL, "save", {
		saveas: "package.json", 
		name: "PA Hub update information",
		mode: "async",
		success: function(data) {
			var onlinePackageJSON = readJSONfromFile(path.join(constant.PAHUB_CACHE_DIR, "package.json"));
			if (onlinePackageJSON != false) {
				var onlinePackage = onlinePackageJSON;
				pahub.api.log.addLogMessage("info", "PA Hub current version: " + pahubPackage.version);
				pahub.api.log.addLogMessage("info", "PA Hub latest version: " + onlinePackageJSON.version);
			}
		},
		fail: function(data) {
			//error
		}
	});
}

function loadCorePlugins() {
	if (pahubConfig.hasOwnProperty("plugins_core") == true) {
		if ($.isArray(pahubConfig.plugins_core)) {
			for(var i = 0; i < pahubConfig.plugins_core.length; i++) {
				pahub.api.log.addLogMessage("info", "Found Core Plugin: '" + pahubConfig.plugins_core[i] + "'");
			}
			for(var i = 0; i < pahubConfig.plugins_core.length; i++) {
				pahub.api.plugin.loadPlugin(path.join(constant.PAHUB_PLUGIN_DIR, pahubConfig.plugins_core[i]), function(plugin) {
					plugin.enabled = true;
					model.core_plugins.push(plugin);
				});
			}
		} else {
			pahub.api.log.addLogMessage("error", "Error processing PAHUB config file: 'plugins_core' not an array");
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
	pahub.api.log.addLogMessage("debug", "Writing to file: " + getShortPathString(file));
	try {
		fs.writeFileSync(file, data);
		return true;
	} catch(err) {
		pahub.api.log.addLogMessage("error", "Error writing to file: " + err);
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
	if (typeof url == 'string') {
		var short_path = url
			.replace(constant.PAHUB_PLUGIN_DIR, "<PAHUB_PLUGIN_DIR>")
			.replace(constant.PAHUB_CONTENT_DIR, "<PAHUB_CONTENT_DIR>")
			.replace(constant.PAHUB_DATA_DIR, "<PAHUB_DATA_DIR>")
			.replace(constant.PAHUB_CACHE_DIR, "<PAHUB_CACHE_DIR>")
			.replace(constant.PA_DATA_DIR, "<PA_DATA_DIR>");
		
		return short_path;
	} 
	return "";
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
		pahub.api.log.addLogMessage("debug", "Loading file: " + getShortPathString(file));
		try {
			var readFile = fs.readFileSync(path.normalize(file));
			return readFile;
		} catch (err) {
			pahub.api.log.addLogMessage("error", "Error loading file: " + err);
			return false;
		}
	} else {
		pahub.api.log.addLogMessage("error", "Error loading file - File not found: " + getShortPathString(file));
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

