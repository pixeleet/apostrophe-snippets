// JavaScript which enables editing of this module's content belongs here.

// See this module's README for more information about subclassing snippets.

function AposSnippets(options) {
  var self = this;

  // These are all provided via pushGlobalCallWhen in snippets/index.js
  self._instance = options.instance;
  self._css = options.css;
  self._typeCss = options.typeCss;
  self.manager = options.manager;

  self._action = options.action;
  // "Manage" pagination
  self._managePerPage = options.managePerPage || 20;
  self.schema = options.schema;
  self.indexSchema = options.indexSchema;

  // PAGE SETTINGS FOR THIS TYPE

  self.settings = {
    serialize: function($el, $details, callback) {
      var data = {};
      return aposSchemas.convertFields($details, self.indexSchema, data, function(err) {
        return callback(err, data);
      });
    },
    unserialize: function(data, $el, $details, callback) {
      return aposSchemas.populateFields($details, self.indexSchema, data, callback);
    }
  };

  // BEGIN MANAGER FUNCTIONALITY

  if (self.manager) {

    // Make a new snippet
    $('body').on('click', '[data-new-' + self._css + ']', function() {
      self.launchNew();
      return false;
    });

    self.launchNew = function() {
      var $el = apos.modalFromTemplate('.apos-new-' + self._css, {
        save: function(callback) {
          return self.insertOrUpdate($el, 'insert', {}, callback);
        },
        init: function(callback) {
          var defaultSnippet = self.getDefaultSnippet();
          return self.populateEditor($el, defaultSnippet, callback);
        },
        next: function() {
          self.launchNew();
        }
      });
      if (!$el.length) {
        apos.log('ERROR: there is no template with the apos-new-' + self._css + ' class. You probably need to copy and edit new.html and edit.html for your snippet subclass.');
      }
    };

    // Copy a snippet
    $('body').on('click', '[data-copy-' + self._css + ']', function() {
      self.edit($(this).attr('data-slug'), true);
      return false;
    });

    // Populate the editor's fields and invoke the afterPopulatingEditor callback
    // for easy extension by those not relying on the schema
    self.populateEditor = function($el, snippet, callback) {
      self.populateFields($el, snippet, function() {
        return self.afterPopulatingEditor($el, snippet, callback);
      });
    };

    // Populate all fields specified in the schema and also any custom fields implemented
    // directly. Used for "new" and "edit"
    self.populateFields = function($el, snippet, callback) {
      return self.populateSomeFields($el, self.schema, snippet, callback);
    };

    self.getDefaultSnippet = function() {
      var def = {};
      _.each(self.schema, function(field) {
        if (field.def !== undefined) {
          def[field.name] = field.def;
        }
      });
      return def;
    };

    self.populateSomeFields = function($el, schema, snippet, callback) {
      return aposSchemas.populateFields($el, schema, snippet, callback);
    };

    self.convertSomeFields = function($el, schema, data, callback) {
      return aposSchemas.convertFields($el, schema, data, callback);
    };

    self.addingToManager = function($el, $snippet, snippet) {
    };

    self.afterPopulatingManager = function($el, $snippets, snippets, callback) {
      return callback();
    };

    self.afterPopulatingEditor = function($el, snippet, callback) {
      return callback();
    };

    self.beforeUpdate = function($el, data, callback) {
      return callback();
    };

    self.beforeInsert = function($el, data, callback) {
      return callback();
    };

    self.beforeSave = function($el, data, callback) {
      return callback();
    };

    self.insertOrUpdate = function($el, action, options, callback) {
      var data = {
        type: $el.find('[name="type"]').val(),
        originalSlug: options.slug
      };

      self.convertSomeFields($el, self.schema, data, function(err) {
        if (err) {
          // Balk on "required" or similar error
          aposSchemas.scrollToError($el);
          return;
        }
        return self._validate($el, data, action, function(err) {
          if (err) {
            // Balk on validation error
            aposSchemas.scrollToError($el);
            return;
          }
          if (action === 'update') {
            self.beforeUpdate($el, data, afterAction);
          } else {
            self.beforeInsert($el, data, afterAction);
          }
          // beforeSave is more convenient in most cases
          function afterAction() {
            self.beforeSave($el, data, go);
          }
        });
      });

      function go() {
        $.ajax(
          {
            url: self._action + '/' + action,
            data: data,
            type: 'POST',
            dataType: 'json',
            success: function(data) {

              // Let anything that cares about changes to items of this kind know
              apos.change(self.name);
              return callback(null);
            },
            error: function() {
              alert('Server error');
              return callback('Server error');
            }
          }
        );
      }
    };

    self.filterDefaults = {
      trash: '0',
      published: 'any',
      q: ''
    };

    self.filters = {};
    $.extend(true, self.filters, self.filterDefaults);

    // Manage all snippets
    $('body').on('click', '[data-manage-' + self._css + ']', function() {
      var snippets;
      var page = 1;
      var total;

      // Reset filters
      $.extend(true, self.filters, self.filterDefaults);

      $el = apos.modalFromTemplate('.apos-manage-' + self._css, {
        init: function(callback) {
          // We want to know if a snippet is modified
          $el.attr('data-apos-trigger-' + apos.cssName(self.name), '');
          // Trigger an initial refresh
          triggerRefresh(callback);
        }
      });

      // Set current active choices for pill buttons

      $el.find('[data-pill] [data-choice]').removeClass('apos-active');
      _.each(self.filters, function(value, filter) {
        $el.find('[data-pill][data-name="' + filter + '"] [data-choice="' + value + '"]').addClass('apos-active');
      });

      // Filter clicks
      $el.on('click', '[data-pill] [data-choice]', function() {
        var $choice = $(this);
        var $pill = $choice.closest('[data-pill]');
        $pill.find('[data-choice]').removeClass('apos-active');
        $choice.addClass('apos-active');
        self.filters[$pill.data('name')] = $choice.attr('data-choice');
        page = 1;
        triggerRefresh();
        return false;
      });

      function search() {
        self.filters.q = $el.find('[name=search]').val();
        page = 1;
        triggerRefresh();
        return false;
      }

      function pager() {
        // Rebuild pager based on 'page' and 'total'
        $.get('/apos/pager', { page: page, total: total }, function(data) {
          $el.find('[data-pager-box]').html(data);
        });
      }

      $el.on('keyup', '[name=search]', function(e) {
        if (e.keyCode === 13) {
          page = 1;
          search();
          return false;
        }
      });

      $el.on('click', '[data-search-submit]', function(e) {
        page = 1;
        search();
        return false;
      });

      $el.on('click', '[data-remove-search]', function() {
        self.filters.q = '';
        $el.find('[name=search]').val('');
        page = 1;
        triggerRefresh();
        return false;
      });

      $el.on('click', '[data-page]', function() {
        page = $(this).attr('data-page');
        triggerRefresh();
        return false;
      });

      // Using an event allows things like the new snippet and edit snippet dialogs to
      // tell us we should refresh our list and UI

      $el.on(apos.eventName('aposChange', self.name), function(e, callback) {
        var criteria = { editable: 1, skip: (page - 1) * self._managePerPage, limit: self._managePerPage };
        $.extend(true, criteria, self.filters);

        $.getJSON(self._action + '/get', criteria, function(data) {
          snippets = data.snippets;
          // Compute total pages from total snippets
          total = Math.ceil(data.total / self._managePerPage);
          if (total < 1) {
            total = 1;
          }
          pager();
          $snippets = $el.find('[data-items]');
          $snippets.find('[data-item]:not(.apos-template)').remove();
          _.each(snippets, function(snippet) {
            var $snippet = apos.fromTemplate($snippets.find('[data-item].apos-template'));

            // Set up the copy button
            var $copy = $snippet.find('[data-copy-' + self._css + ']');
            $copy.attr('data-slug', snippet.slug);

            // always populate title, trash and tags
            var $title = $snippet.find('[data-title]');
            $title.text(snippet.title || '[NO TITLE]');
            $title.attr('data-slug', snippet.slug);
            if (snippet.trash) {
              $title.attr('data-trash', 1);
            }
            if (snippet.tags !== null) {
              $snippet.find('[data-tags]').text(snippet.tags);
            }

            // Populate additional fields for each row if they have
            // the "manage: true" property in the schema. This works for all
            // the simple schema field types. It doesn't try to
            // deal with joins, areas or singletons. TODO: this
            // ought to offer field-specific displayers like
            // the edit view does.

            _.each(self.schema, function(field) {
              if (field.manage) {
                var $target = $snippet.find('[data-' + apos.cssName(field.name) + ']');
                var val = snippet[field.name];
                if (field.type === 'boolean') {
                  $target.text(val ? 'Yes' : 'No');
                } else {
                  $target.text(val);
                }
              }
            });

            self.addingToManager($el, $snippet, snippet);
            $snippets.append($snippet);
          });
          self.afterPopulatingManager($el, $snippets, snippets, function() {
            if (callback) {
              return callback(null);
            }
          });
        });
      });
    });

    // Edit one snippet
    $('body').on('click', '[data-edit-' + self._css + ']', function() {
      var slug = $(this).data('slug');
      if ($(this).data('trash')) {
        if (confirm('Bring this item back from the trash?')) {
          $.ajax({
            url: self._action + '/trash',
            data: { slug: slug, trash: 0 },
            type: 'POST',
            success: function() {
              triggerRefresh();
            },
            error: function() {
              alert('You do not have access or the item has been deleted.');
            }
          });
        }
        return false;
      } else {
        self.edit(slug);
        return false;
      }
    });

    self.edit = function(slug, copy) {
      var relaunch = false;
      var active = false;
      var $el = apos.modalFromTemplate('.apos-edit-' + self._css, {
        save: save,
        init: function(callback) {
          active = true;
          if (!$el.length) {
            apos.log('ERROR: there is no template with the apos-edit-' + self._css + ' class. You probably need to copy and edit new.html and edit.html for your snippet subclass.');
          }
          var verb = copy ? '/copy' : '/get-one';

          $.getJSON(self._action + verb, { slug: slug, editable: true }, function(data) {
            if (!data) {
              // TODO all alerts should get prettified into something nicer
              alert('That item does not exist or you do not have permission to edit it.');
              return callback('no such item');
            }
            snippet = data;
            // Copy operations introduce a new slug
            slug = snippet.slug;

            if (copy) {
              // Refresh the manage list view to ensure the new copy is
              // listed there when we get back to it even if the user hits cancel
              triggerRefresh();
            }

            // name=slug must always exist, at least as a hidden field, to support this
            var $title = $el.find('[name=title]');
            var $slug = $el.find('[name=slug]');
            if ($slug.length) {
              apos.suggestSlugOnTitleEdits($title, $slug);
            }

            $el.on('click', '[data-action="delete"]', function() {
              $.ajax({
                url: self._action + '/trash',
                data: { slug: slug, trash: 1 },
                type: 'POST',
                success: function() {
                  triggerRefresh();
                  $el.trigger('aposModalHide');
                },
                error: function() {
                  alert('You do not have access or the item has been deleted.');
                }
              });
              return false;
            });

            $el.on('click', '[data-action="copy"]', function() {
              // Dismiss this one, open an editor for a new copy
              $el.trigger('aposModalHide');
              self.edit(slug, true);
              return false;
            });

            $el.on('click', '[data-action="versions"]', function() {
              aposPages.browseVersions(snippet._id);
              return false;
            });

            $el.attr('data-apos-trigger-revert', '');

            // Without this check old dialogs can rise from the dead.
            // TODO: figure out how to kill them more definitively when they are done.
            $el.on('aposChangeRevert', function() {
              if (active) {
                relaunch = true;
                $el.trigger('aposModalHide');
              }
            });

            return self.populateEditor($el, snippet, callback);
          });
        },
        afterHide: function(callback) {
          active = false;
          // Relaunch after a world-changing event like reverting the snippet
          if (relaunch) {
            self.edit(slug);
            return callback(null);
          }
        }
      });

      function save(callback) {
        return self.insertOrUpdate($el, 'update', { slug: slug }, callback);
      }
      return false;
    };

    // A bc wrapper for invoking self.validate which works even if
    // self.validate is legacy code taking only three arguments.
    // Should not be needed in newer projects, but we expose it here
    // so that apostrophe-moderator can work with older code.

    self._validate = function($el, data, action, callback) {
      var validate;
      // bc with 3-argument validators
      if (self.validate.length === 3) {
        return self.validate($el, action, callback);
      } else {
        return self.validate($el, data, action, callback);
      }
    };

    // You may optionally override this method to validate the form. Inspect the
    // properties of `data` or, if you wish, directly examine `$el` via jQuery. If
    // you don't like what you see, invoke callback with anything other
    // than null to block the saving of the form and continue editing. There is a strong
    // bias toward sanitizing the user's input rather than blocking them in this way, but
    // in some applications it is worthwhile.
    //
    // `action` will be either `insert` or `update`. If the distinction between a new
    // item and an updated one is irrelevant to your validation you may ignore it.

    self.validate = function($el, data, action, callback) {
      return callback(null);
    };

    self.extendWidget = function(widget) {
      // A chance to extend the snippet widget
    };

    // Import snippets
    $('body').on('click', '[data-import-' + self._css + ']', function() {
      var valid = false;
      var jobId;
      var $save;
      var $cancel;
      $el = apos.modalFromTemplate('.apos-import-' + self._css, {
        init: function(callback) {
          $save = $el.find('[data-action="save"]');
          $cancel = $el.find('[data-action="cancel"]');
          $save.hide();
          // The file upload's completion will trigger the import operation
          $el.find('[name="file"]').attr('data-url', self._action + '/import');
          $el.find('[name="file"]').fileupload({
            maxNumberOfFiles: 1,
            dataType: 'json',
            start: function (e) {
              status('uploading', false);
            },
            stop: function (e) {
              // Let the server tell us when it's really done receiving
              // via our AJAX pings
            },
            done: function (e, data) {
              var result = data.result;
              if (!result.jobId) {
                alert('An error occurred. The import process did not begin.');
                return;
              }
              jobId = result.jobId;
              setTimeout(update, 1000);
            }
          });
          function update() {
            $.getJSON(self._action + '/import-status', {
              jobId: jobId,
              cacheBuster: $.now()
            }, function(result) {
              var done = status(result.status);
              rows(result.rows);
              errors(result.errors);
              errorLog(result.errorLog);
              if (!done) {
                setTimeout(update, 1000);
              }
            });
          }
          return callback(null);
        }
      });
      function status(s) {
        $el.find('[data-status]').text(s);
        if (s === 'done') {
          $cancel.hide();
          $save.show();
          return true;
        }
      }
      function rows(r) {
        $el.find('[data-rows]').text(r);
      }
      function errors(e) {
        $el.find('[data-errors]').text(e);
      }
      function errorLog(log) {
        var $log = $el.find('[data-error-log]');
        $log.html('');
        _.each(log, function(item) {
          var $entry = $('<li></li>');
          $entry.text(item);
          $log.append($entry);
        });
      }
    });
  }
  function triggerRefresh(callback) {
    $el.trigger(apos.eventName('aposChange', self.name), callback);
  }
  // END MANAGER FUNCTIONALITY
}

// TODO: this is terrifically dumb. Figure out how to make this a regular method of the
// manager object you just constructed. Also figure out how to participate in
// apos.addWidgetType() normally.

AposSnippets.addWidgetType = function(options) {
  options = options || {};
  // _class contains properties common to all instances of the widget
  // Having this here is redundant and we need to figure out how to kill it
  var _class = {
    name: options.name || 'snippets',
    label: options.label || 'Snippets',
    action: options.action || '/apos-snippets',
    instance: options.instance || 'snippet',
    defaultLimit: options.defaultLimit || 1
  };

  apos.widgetTypes[_class.name] = {
    // For the rich content editor's menu
    label: _class.label,

    // Constructor
    editor: function(options) {
      var self = this;
      self._class = _class;

      self.action = self._class.action;
      self.defaultLimit = options.limit || self._class.defaultLimit;

      self.type = options.type || self._class.name;
      self.css = apos.cssName(self.type);
      options.template = '.apos-' + self.css + '-widget-editor';

      if (!options.messages) {
        options.messages = {};
      }
      if (!options.messages.missing) {
        options.messages.missing = 'Pick at least one.';
      }

      self.afterCreatingEl = function() {
        if (self.data.limitByTag === undefined) {
          self.data.limitByTag = self.defaultLimit;
        }
        if (self.data.limit === undefined) {
          self.data.limit = self.defaultLimit;
        }

        self.$by = self.$el.findByName('by');
        self.$by.val(self.data.by || 'id');
        self.$tags = self.$el.find('[data-name="tags"]');
        apos.enableTags(self.$tags, self.data.tags);
        self.$limitByTag = self.$el.findByName('limitByTag');
        self.$limitByTag.val(self.data.limitByTag);
        self.$limit = self.$el.find('[name="limit"]');
        self.$limit.val(self.data.limit);
        self.$ids = self.$el.find('[data-name="ids"]');

        self.$by.on('change', function() {
          var val = $(this).val();
          self.$el.find('[data-by]').removeClass('apos-active');
          var $activeFieldset = self.$el.find('[data-by="' + val + '"]');
          $activeFieldset.addClass('apos-active');
          // Ready to type something
          $activeFieldset.find('input[type="text"]:first').focus();
          return false;
        });

        // Send a change event to enable the currently chosen type
        // after jquery selective initializes
        apos.afterYield(function() {
          self.$by.trigger('change');
        });

        // Get the titles corresponding to the existing list of idss.
        //
        // We're going to get a prePreview call before this
        // completes. Set a flag to indicate we're not done yet.
        //
        // prePreview will call debrief, which spots this flag and
        // sets pendingCallback rather than calling back directly.
        // We can then invoke pendingCallback here when we're
        // good and ready.
        //
        // This would be easier if afterCreatingEl took a callback.
        // TODO: refactor afterCreatingEl for all widgets.

        self.pending = true;

        $.jsonCall(self.action + '/autocomplete', { values: self.data.ids || []}, function(data) {
          self.pending = false;
          self.$ids.selective({
            data: data,
            source: self.action + '/autocomplete',
            sortable: true,
            limit: options.options.limit
          });
          if (self.pendingCallback) {
            return self.pendingCallback();
          }
        });
      };

      // Parent class constructor shared by all widget editors
      AposWidgetEditor.call(self, options);

      self.debrief = function(callback) {
        self.data.by = self.$by.val();
        self.data.tags = self.$tags.selective('get', { incomplete: true });
        self.data.limit = parseInt(self.$limit.val(), 10);
        if (self.pending) {
          self.pendingCallback = whenReady;
          return;
        } else {
          return whenReady();
        }
        function whenReady() {
          self.data.ids = self.$ids.selective('get', { incomplete: true });
          // Don't force them to pick something, it's common to want to go back
          // to an empty singleton
          self.exists = true;
          return callback();
        }
      };

      self.prePreview = self.debrief;
      self.preSave = self.debrief;

      // Give the manager for this instance type a chance to
      // extend the widget
      var manager = aposPages.getManager(self._class.instance);
      manager.extendWidget(self);
    }
  };
};

// When we explicitly subclass snippets, there must also be a subclass on
// the browser side. However sometimes this subclass really has no unique
// work to do, so we can synthesize it automatically. Do so if no
// constructor for it is found.

AposSnippets.subclassIfNeeded = function(constructorName, baseConstructorName, options) {
  if (!window[constructorName]) {
    window[constructorName] = function(options) {
      var self = this;
      window[baseConstructorName].call(self, options);
    };
  }
};
