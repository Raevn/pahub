var pahub = {
	api: {
		section: {
			addSection: function (section_id, display_name, img_src) { model.addSection(section_id, display_name, img_src); },
			removeSection: function (section_id) { model.removeSection(section_id); },
			setActiveSection: function (section_id) { model.setActiveSection(section_id); }
		},
		tab: {
			addTab: function (section_id, tab_id, display_name, img_src) { model.addTab(section_id, tab_id, display_name, img_src); },
			removeTab: function (section_id, tab_id) { model.removeTab(section_id, tab_id); },
			setTabContent: function (section_id, tab_id, content) { model.setTabContent(section_id, tab_id, content); },
			setActiveTab: function (tab_id) { model.setActiveTab(section_id); }
		},
		locale: {
			setLocale: function (locale_id) { model.setLocale(locale_id); },
			addLocData: function (locale_id, data) { model.addLocData(locale_id, data); },
			getCurrentLocaleText: function (loc_key, defaultText) { return model.current_loc_data()[loc_key] || defaultText},
			getLocaleText: function (locale_id, loc_key) { return model.loc_data()[model.getMapItemIndex(model.loc_data(), "locale_id", locale_id)].data()[loc_key] || null}
		},
		plugin: {
			loadPlugin: function (folder, success) { model.loadPlugin(folder, success); },
			unloadPlugin: function (plugin_id) { return model.unloadPlugin(plugin_id); },
			getPluginLoaded: function (plugin_id) { return model.getPluginLoaded(plugin_id); },
			getPlugin: function (plugin_id) { return model.getPlugin(plugin_id); }
		},
		log: {
			addLogMessage: function (type, time, message) { model.addLogMessage(type, time, message); },
			getLogMessages: function () { return model.log_messages(); },
			writeLog: function() { return model.writeLog(); }
		},
		resource: {
			isDownloading: function() { return model.downloading();},
			currentDownload: function() { return model.downloading_item();},
			loadResource: function(url, action, params) { model.loadResource(url, action, params); },
			getTotalDownloaded: function() { return model.download_total_bytes(); },
		},
		gui: {
			setSectionsBarMinimisedState: function(minimised) { model.sections_minimised(minimised); },
			getSectionsBarMinimisedState: function() { return model.sections_minimised(); }
		}
	}
};