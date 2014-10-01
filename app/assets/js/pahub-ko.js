var model;
var koActivated = false;
var fs = require('fs');
var path = require('path');

$(document).ready(function () {

	function pahubViewModel() {
		var self = this;
		
		/*********
		 *  GUI  *
		 *********/
		
		self.sections_minimised = ko.observable(false);
		
		/***************
		 *  RESOURCES  *
		 ***************/
		
		self.connections = 0;
		
		self.downloading = ko.observable(false);
		
		self.downloading_item = ko.observable("");
		
		self.resource_queue = ko.observableArray();
		
		self.download_total_bytes = ko.computed(function() {
			var total = 0;
			for (var i = 0; i < self.resource_queue().length; i++) {
				if (self.resource_queue()[i].local == false) {
					total += self.resource_queue()[i].completed();
				}
			}
			return total;
		});
		
		// action: 
		//		"load": for js & css - inserts the contents of the loaded file in <script> / <style> elements into the page.
		//		"save": saves the file to cache
		//		"get": sends a request to the specified URL.
		// params:
		//		name: a short description to be displayed on the GUI
		//		mode: "sync" or "async". All items are downloaded immediately, but "sync" items are only processed in the order they are requested. 
		//		saveas: if action=save, this will be the filename of the downloaded file.
		//		success: function to call on load success
		//		fail: function to call on load failure
		//		always: function to call on load success or failure
		//
		
		self.loadResource = function(url, action, params) {
			//action = load, save
			//validation
			self.connections++;
			
			var local = true;
			
			if (fs.existsSync(url) == false) {
				local = false;
			}
			
			self.resource_queue.push({
				cid: self.connections,
				url: url, 
				type: path.extname(url),
				action: action,
				mode: params["mode"] || "sync",
				name: params["name"] || "",
				success: params["success"],
				fail: params["fail"],
				always: params["always"],
				saveas: params["saveas"],
				local: local,
				size: ko.observable(0),
				completed: ko.observable(0),
				percent: ko.observable(0),
				lengthComputable: ko.observable(false),
				data: null,
				status: "",
				processed: ko.observable(false)
			});
			pahub.api.log.addLogMessage("debug", "<CID #" + self.connections + "> Queuing resource load: " + getShortPathString(url));

			if (local == true) {
				setTimeout(function(resource) {self.downloadLocalResource(resource)}, 10, self.resource_queue()[self.resource_queue().length-1]);
			} else {
				setTimeout(function(resource) {self.downloadNetworkResource(resource)}, 10, self.resource_queue()[self.resource_queue().length-1]);
			}
		}
		
		self.processResourceQueue = function() {
			pahub.api.log.addLogMessage("debug", "Processing Resource Queue");
			var processed = 0;
			var process_sync = true;
			
			var i = 0;
			do {
				if (self.resource_queue()[i].processed() == false) {
					if (process_sync == true && self.resource_queue()[i].mode == "sync" || self.resource_queue()[i].mode == "async") {
						if (self.resource_queue()[i].status != "") {
							if (self.resource_queue()[i].status == "complete") {
								if (self.resource_queue()[i].action == "load") {
									var tag = "";
									if (path.extname(path.normalize(self.resource_queue()[i].url)) == ".js") {
										tag = document.createElement("script");
										tag.type = "text/javascript";
										tag.id = getSafeString(path.basename(path.normalize(self.resource_queue()[i].url)));
										tag.text = self.resource_queue()[i].data;
									}
									if (path.extname(path.normalize(self.resource_queue()[i].url)) == ".css") {
										tag = document.createElement("link");
										tag.type = "text/css";
										tag.id = getSafeString(path.basename(path.normalize(self.resource_queue()[i].url)));
										tag.rel = "stylesheet";
										tag.href = path.normalize(self.resource_queue()[i].url);
									}
									var head = document.getElementsByTagName("head")[0];
									head.appendChild(tag);
								}
								
								if (self.resource_queue()[i].action == "save") {
									if (self.resource_queue()[i].hasOwnProperty("saveas") == true) {
										writeToFile(path.join(constant.PAHUB_CACHE_DIR, self.resource_queue()[i].saveas), new Buffer(new Uint8Array(self.resource_queue()[i].data)));
									} else {
										writeToFile(path.join(constant.PAHUB_CACHE_DIR, path.basename(self.resource_queue()[i].url)), new Buffer(new Uint8Array(self.resource_queue()[i].data)));
									}
								}
								
								self.resource_queue()[i].processed(true);
								processed++;
								
								if (typeof self.resource_queue()[i].success === 'function') {
									self.resource_queue()[i].success(self.resource_queue()[i]);
								}
							} else if (self.resource_queue()[i].status == "failed") {
							
								self.resource_queue()[i].processed(true);
								processed++;
								
								if (typeof self.resource_queue()[i].fail === 'function') {
									self.resource_queue()[i].fail(self.resource_queue()[i]);
								}
							}
							
							if (typeof self.resource_queue()[i].always === 'function') {
								self.resource_queue()[i].always(self.resource_queue()[i]);
							}
							
							self.resource_queue()[i].data = null;
						} else {
							//only continue processing sync resources if this one was async
							process_sync = self.resource_queue()[i].mode == "async";
						}
					}
				} else {
					processed++;
				}
				i++;
			} while (i < self.resource_queue().length);
			
			if (processed == self.resource_queue().length) {
				self.downloading(false)
			}
		}
		
		self.downloadLocalResource = function(resource) {
			pahub.api.log.addLogMessage("debug", "<CID #" + resource.cid + "> Loading local resource: '" + resource.name + "'");
			
			resource.data = readFromFile(resource.url);
			
			fs.stat(resource.url, function (err, stats) {
				resource.completed(stats.size);
			});
			
			resource.size(resource.completed());
			resource.percent(1);
			resource.status = "complete";
			
			pahub.api.log.addLogMessage("debug", "<CID #" + resource.cid + "> Loading resource completed");
			
			self.processResourceQueue();
		}
		
		self.downloadNetworkResource = function(resource) {
			pahub.api.log.addLogMessage("debug", "<CID #" + resource.cid + "> Loading network resource: '" + resource.name + "'");
			var datatype = resource.action == "save" ? "arraybuffer" : "text";
			
			self.downloading(true);
			if (model.downloading_item() == "") {
				model.downloading_item(resource.name);
			}
			
			(function(resource, datatype) {
				
				var xhr = $.ajax({
					progressFunc: function(event) {
						if (resource.completed() == 0) {
							pahub.api.log.addLogMessage("debug", "<CID #" + resource.cid + "> Commencing download");
						}
						if (event.lengthComputable) {
							if (resource.size() == 0 && resource.size() != event.total) {
								pahub.api.log.addLogMessage("debug", "<CID #" + resource.cid + "> Resource size: " + getFileSizeString(event.total));
							}
							resource.percent(event.loaded / event.total);
							resource.size(event.total);
							resource.lengthComputable(true);
						}
						resource.completed(event.loaded);
						
						if (model.downloading_item() == "") {
							model.downloading_item(resource.name);
						}
					},
					
					type: 'GET',
					url: resource.url,
					dataType: datatype,
					async: true
				})
				.done(function(data, textStatus, jqXHR) {
					resource.size(resource.completed());
					resource.percent(1);
					resource.status = "complete";
					resource.data = data;
					model.downloading_item("");
					pahub.api.log.addLogMessage("debug", "<CID #" + resource.cid + "> Loading resource completed");
				})
				.fail(function(data, textStatus, errorThrown) {
					pahub.api.log.addLogMessage("error", "<CID #" + resource.cid + "> Error: " + errorThrown);	
					
					resource.status = "failed";
				})
				.always(function(data, textStatus, jqXHR) {	
					self.processResourceQueue();
				});
			})(resource, datatype);
		}
		
		/** LOGGING **/
		
		self.log_messages = ko.observableArray();
		
		//  type: "info", "warn", "error", "debug", "verb".
		self.addLogMessage = function (type, message) {
			if (["info", "warn", "error", "verb", "debug"].indexOf(type) > -1) {
				var now = new Date(); 
			
				self.log_messages.push({
					"type": type, 
					"time": now,
					"message": message,
					"debug": type == "debug"
				});
				
				if (constant.hasOwnProperty("PAHUB_LOG_FILE") == true) {
					appendToFile(constant.PAHUB_LOG_FILE, getTimeString(now) + " [" + type + "] " + ((type == "info" || type == "warn" || type == "verb") ? " " : "") + message + "\r\n");
				}
			} else {
				pahub.api.log.addLogMessage("error", "addLogMessage: Value of parameter 'type' is not allowed");
			}
		}
		
		//deletes and re-writes out the log file.
		self.writeLog = function () {
			if(fs.existsSync(constant.PAHUB_LOG_FILE) == true) {
				fs.unlink(constant.PAHUB_LOG_FILE);
			}
			for(var i = 0; i < self.log_messages().length; i++) {
				appendToFile(constant.PAHUB_LOG_FILE, getTimeString(self.log_messages()[i].time) + " [" + self.log_messages()[i].type + "] " + ((self.log_messages()[i].type == "info" || self.log_messages()[i].type == "warn" || self.log_messages()[i].type == "verb") ? " " : "") + self.log_messages()[i].message + "\r\n");
			}
		}

		/***********
		 * PLUGINS *
		 ***********/
		
		self.loaded_plugins = ko.observableArray();
		self.core_plugins = ko.observableArray();
		
		self.getPlugin = function(plugin_id) {
			return self.loaded_plugins()[getMapItemIndex(self.loaded_plugins(), "content_id", plugin_id)];
		}
		
		self.isCorePlugin = function(plugin_id) {
			return getMapItemIndex(self.core_plugins(), "content_id", plugin_id) > -1;
		}
		
		self.getPluginLoaded = function(plugin_id) {
			return getMapItemIndex(self.loaded_plugins(), "content_id", plugin_id) > -1;
		}
		
		self.unloadPlugin = function(plugin_id) {
			var plugin = pahub.api.plugin.getPlugin(plugin_id);
			if (pahub.api.plugin.getPluginLoaded(plugin_id) == true)  {
				if (plugin.hasOwnProperty("resources") == true) {
					for (var i = 0; i < plugin.resources.length; i++) {
						$(getSafeString(path.basename(path.normalize(plugin.resources[i])))).remove();
					}
				}
				if (plugin.hasOwnProperty("unload_func")) {
					if (typeof window[plugin.unload_func] === 'function') {
						self.loaded_plugins.splice(getMapItemIndex(self.loaded_plugins(), "content_id", plugin_id),1);
						pahub.api.log.addLogMessage("debug", "Calling unload function for plugin '" + plugin_id + "'");
						window[plugin.unload_func](plugin);
					}
				}
			}
		}
		
		self.loadPlugin = function(folder, success) {
			pahub.api.log.addLogMessage("verb", "Loading Plugin from folder '" + path.basename(path.normalize(folder)) + "'");
			var info = readJSONfromFile(path.join(folder, "content-info.json"));
			
			if (info != false) {
				
				var plugin_id = info.content_id;
				//check for malformed/missing JSON
				
				if (pahub.api.plugin.getPluginLoaded(plugin_id) == false)  {
					self.loaded_plugins.push(info);
					
					if (info.hasOwnProperty("resources") == true) {
						for (var i = 0; i < info.resources.length; i++) {
							var success_func = null;
							if (i == info.resources.length - 1) {							
								pahub.api.resource.loadResource(path.join(folder, info.resources[i]), "load", {name:"Plugin resource: " + info.resources[i], success: function() {
									if (info.hasOwnProperty("load_func")) {
										if (typeof window[info.load_func] === 'function') {
											pahub.api.log.addLogMessage("debug", "Calling load function for plugin '" + plugin_id + "': " + info.load_func);
											window[info.load_func](info, folder);
										} else {
											pahub.api.log.addLogMessage("error", "Could not find load_func for plugin '" + plugin_id + "' : " + info.load_func);
										}
									}
									
									if (typeof success === 'function') {
										success(info);
									}
								}});
								
							} else {
								pahub.api.resource.loadResource(path.join(folder, info.resources[i]), "load", {name:"Plugin resource: " + info.resources[i]});
							}
						}
					} else {
						pahub.api.log.addLogMessage("error", "Plugin '" + plugin_id + "' malformed: missing attribute 'resources'");
					}
				} else {
					pahub.api.log.addLogMessage("error", "Plugin '" + plugin_id + "' already loaded");
				}
			}
		}

		self.sectionExists = function(section_id) {
			return getMapItemIndex(self.sections(), "section_id", section_id) > -1;
		}
		
		self.tabExists = function(tab_id) {
			return getMapItemIndex(self.current_tabs(), "tab_id", tab_id) > -1;
		}
		
		self.sectionTabExists = function(section_id, tab_id) {
			return getMapItemIndex(self.sections()[getMapItemIndex(self.sections(), "section_id", section_id)].tabs(), "tab_id", tab_id) > -1;
		}
		
		self.localeExists = function(locale_id) {
			return getMapItemIndex(self.loc_data(), "locale_id", locale_id) > -1;
		}
		
		
		self.loc_data = ko.observableArray();
		self.locale = ko.observable();
		self.locales = ko.observableArray();
		self.current_loc_data = ko.computed(function() { 
			if (self.localeExists(self.locale()) == true) {
				return self.loc_data()[getMapItemIndex(self.loc_data(), "locale_id", self.locale())].data();
			} else {
				return {};
			}
		});
				
		self.sections = ko.observableArray();
		self.active_section = ko.observable(); //make this computed, based on active_section_id
		self.active_section_id = ko.observable("");
				
		self.active_tab = ko.observable(); //make this computed, based on active_tab_id
		self.active_tab_id = ko.observable("");
		self.current_tabs = ko.computed(function() { 
			if (self.active_section()) {
				return self.active_section().tabs();
			} else {
				return [];
			}
		});
		
		
		self.addSection = function (section_id, display_name, img_src, location, index) {
			//TODO: Logging
			//TODO: Validity Checking
			//location: sections, header
			
			if (self.sectionExists(section_id) == false) {
				self.sections.push({
					section_id: section_id,
					display_name: display_name,
					loc_key: createLocKey(display_name),
					img_src: img_src || null,
					index: index,
					location: location,
					tabs: ko.observableArray()
				});
				
				self.sections.sort(function(left, right) {
					return left.index == right.index ? 0 : (left.index < right.index ? -1 : 1);
				});
				
				if (self.active_section_id() == "") {
					self.setActiveSection(section_id);
				}
			}
		}
		
		self.removeSection = function (section_id) {
			//TODO: Logging

			if (self.sectionExists(section_id) == true) {
				self.sections.remove(function(item) { return item.section_id == section_id});
				
				if (self.active_section_id() == section_id) {
					self.setActiveSection("");
				}
			}
		}
		
		self.setActiveSection = function (section_id) {
			//TODO: Logging
			//TODO: Validity Checking
			if (self.active_section_id() != section_id) {
				if (section_id == "") {
					section_id = self.sections()[0].section_id;
				}
				if (self.sectionExists(section_id) == true) {
					self.active_section_id(section_id);
					self.active_section(self.sections()[getMapItemIndex(self.sections(), "section_id", section_id)]);
					if (self.current_tabs().length > 0) {
						self.setActiveTab(self.current_tabs()[0].tab_id);
					} else {
						self.setActiveTab("");
					}
				}
			}
		}
		
		self.lastSection = ko.computed(function() {
			var last = 0;
			for(var i =0; i < self.sections().length; i++) {
				if (self.sections()[i].location == "sections") {
					last = i;
				}
			}
			return last;
		})
		
		self.addTab = function (section_id, tab_id, display_name, img_src, index) {
			//TODO: Logging
			//TODO: Validity Checking
			
			if (self.sectionExists(section_id) == true) {

				var section = self.sections()[getMapItemIndex(self.sections(), "section_id", section_id)];
				
				if (self.tabExists(tab_id) == false) {
					section.tabs.push({
						tab_id: tab_id,
						display_name: display_name || null,
						loc_key: createLocKey(display_name) || null,
						img_src: img_src || null,
						index: index
					});
				}
				
				section.tabs.sort(function(left, right) {
					return left.index == right.index ? 0 : (left.index < right.index ? -1 : 1);
				});
				
				$('#wrapper-content').append("<div id=\"content-" + section_id + "-" + tab_id + "\" data-bind=\"visible: model.active_section_id() == '" + section_id + "' && model.active_tab_id() == '" + tab_id + "'\" class=\"content\"></div>");

				if (koActivated == true) {
					ko.cleanNode(document.getElementById("content-" + section_id + "-" + tab_id));
					ko.applyBindings(model, document.getElementById("content-" + section_id + "-" + tab_id));
				}

				if (self.active_section_id() == section_id) {
					if (self.active_tab_id() == "") {
						self.setActiveTab(tab_id);
					}
				}
			}
		}
		
		self.removeTab = function(section_id, tab_id) {
			//TODO: Logging

			if (self.sectionExists(section_id) == true) {
				if (self.sectionTabExists(section_id, tab_id) == true) {
					self.sections()[getMapItemIndex(self.sections(), "section_id", section_id)].tabs.remove(function(item) { return item.tab_id == tab_id});
					
					ko.cleanNode(document.getElementById("innercontent-" + section_id + "-" + tab_id));
					$("#content-" + section_id + "-" + tab_id).remove();
					$("#innercontent-" + section_id + "-" + tab_id).remove();
					
					if (self.active_tab_id() == tab_id) {
						self.setActiveTab("");
					}
				}
			}
		}
		
		self.setActiveTab = function(tab_id) {
			//TODO: Logging
			//TODO: Validity Checking (eg. in current section)
			if (self.active_tab_id() != tab_id) {
				if (tab_id == "" && self.current_tabs().length > 0) {
					tab_id = self.current_tabs()[0].tab_id;
				}
				if (self.tabExists(tab_id) == true) {
					self.active_tab_id(tab_id);
					self.active_tab(self.current_tabs()[getMapItemIndex(self.current_tabs(), "tab_id", tab_id)]);
				}
			}
		}
		
		self.setTabContent = function(section_id, tab_id, content) {
			//TODO: Logging
			//TODO: Validity Checking
			
			if (self.sectionExists(section_id) == true) {
				if (self.sectionTabExists(section_id, tab_id) == true) {				
					$("#content-" + section_id + "-" + tab_id).html("<div id=\"innercontent-" + section_id + "-" + tab_id + "\" class='innercontent'>" + content + "</div>");
					if (koActivated == true) {
						
						ko.cleanNode(document.getElementById("innercontent-" + section_id + "-" + tab_id));
						ko.applyBindings(model, document.getElementById("innercontent-" + section_id + "-" + tab_id));
					}
				}
			}
		}
		
		self.setLocale = function(locale_id) {
			self.locale(locale_id);
		}
		
		self.addLocData = function(locale_id, data) {
			if (self.localeExists(locale_id) == true) {
				self.loc_data()[getMapItemIndex(self.loc_data(), "locale_id", locale_id)].data($.extend({}, self.loc_data()[getMapItemIndex(self.loc_data(), "locale_id", locale_id)].data(), data));
			} else {
				self.locales.push(locale_id);
				
				self.loc_data.push({
					locale_id: locale_id, 
					data: ko.observable(data)
				});
			}
		}
		
	}
	
	model = new pahubViewModel();
	init();
	
	// Activates knockout.js
	ko.applyBindings(model);
	koActivated = true;
});
