var EntryRow = Backbone.View.extend({
    tagName: "tr",
    events: {
        "click a[title='Approve']": "approveEntry",
        "click a[title='Delete']": "deleteEntry",
        "click a[title='Edit']": "editEntry",
        "click a[title='Reject']": "rejectEntry",
        "click a[title='Verify']": "verifyEntry"
    },
    initialize: function() {
        this.listenTo(this.model, "change", this.render);
    },
    render: function() {
        this.$el.attr({id: this.getTagId()});
        if (!this.model.isFromCurrentMonth()) {
            this.$el.addClass('muted')
                    .attr({
                'data-toggle': 'tooltip',
                'title': 'You cannot edit an entry from another month.'
            });
        }
        template = _.template($('#entry-row-template').html(), { model: this.model });
        this.$el.html(template);
        return this;
    },

    // === Custom Methods === //

    approveEntry: function(event) {
        event.preventDefault();
        if (this.model.isFromCurrentMonth()) {
            var msg = this.model.description() + " is now approved.";
            approveEntries(this.model.collection, [this.model.get("id")], msg);
        } else {
            showError("You can't edit an entry from another month.");
        }
    },
    deleteEntry: function() {
        event.preventDefault();
        timesheet.modal.setTitle("Confirm Deletion");
        template = _.template($("#delete-template").html(), { entry: this.model });
        timesheet.modal.setContent(template);
        timesheet.modal.$el.find("#confirm-delete").on("click", function(event) {
            event.preventDefault();
            this.model.destroy({
                success: function(deletedModel, response) {
                    for (var i=0; i < deletedModel.weekTable.models.length; i++) {
                        var model = deletedModel.weekTable.models[i];
                        if (model.get('id') == deletedModel.get('id')) {
                            deletedModel.weekTable.models.splice(i, 1);
                            deletedModel.row.$el.remove();
                            deletedModel.weekTable.updateTotalHours();
                            timesheet.updateProjects();
                            timesheet.modal.hide();
                            break;
                        }
                    }
                    showSuccess(deletedModel.description() + " has been deleted.");
                }
            });
        }.bind(this));
        timesheet.modal.show();
    },
    editEntry: function(event) {
        event.preventDefault();
        var self = this;
        $.ajax({
            url: this.model.get('get_edit_url'),
            dataType: 'html'
        }).done(function(data, status, xhr) {
            timesheet.modal.setTitle("Update Entry");
            timesheet.modal.setContent(data);
            initializeDatepickers();  // For start and end dates.
            var onSubmit = function(event) {
                // It would be too hard to parse the form, set elements on
                // the model, and then call Backbone's save. Instead, we'll
                // submit the form for server-side validation. If the form
                // is valid, we update the model using the returned data.
                // If the form is invalid, we update the form & reattach the
                // this function.
                event.preventDefault();
                $.ajax({
                    type: "POST",
                    url: self.model.get("get_edit_url"),
                    data: $(this).serialize(),
                    success: function(data, status, xhr) {
                        self.model.set(data);
                        self.model.weekTable.updateTotalHours();
                        timesheet.updateProjects();
                        timesheet.modal.hide();
                        showSuccess(self.model.description() + " has been updated.");
                    },
                    error: function(xhr, status, error) {
                        if (xhr.status === 400) {
                            timesheet.modal.setContent(xhr.responseText);
                            initializeDatepickers();  // For start and end dates.
                            timesheet.modal.$el.find('form').on('submit', onSubmit);
                            return;
                        }
                        return handleAjaxFailure(xhr, status, error);
                    }
                })
            };
            timesheet.modal.$el.find('form').on('submit', onSubmit);
            timesheet.modal.show();
        }).fail(handleAjaxFailure);
    },
    getTagId: function() {
        return "entry-" + this.model.get("id");
    },
    rejectEntry: function(event) {
        event.preventDefault();
        if (this.model.isFromCurrentMonth()) {
            var msg = this.model.description() + " is now unverified.";
            rejectEntries(this.model.collection, [this.model.get("id")], msg);
        } else {
            showError("You can't edit an entry from another month.");
        }
    },
    verifyEntry: function(event) {
        event.preventDefault();
        if (this.model.isFromCurrentMonth()) {
            var msg = this.model.description() + " is now verified.";
            verifyEntries(this.model.collection, [this.model.get("id")], msg);
        } else {
            showError("You can't edit an entry from another month.");
        }
    }
});

var WeekTable = Backbone.View.extend({
    tagName: "div",
    events: {
        "click .btn[title='Approve Week']": "approveWeek",
        "click .btn[title='Reject Week']": "rejectWeek",
        "click .btn[title='Verify Week']": "verifyWeek"
    },
    initialize: function() {
        this.models = this.options['models'];
        this.weekStart = this.options['weekStart'];
        this.weekEnd = this.options['weekEnd'];
        this.thisMonth = this.options['thisMonth'];
        this.lastMonth = this.options['lastMonth'];
        this.nextMonth = this.options['nextMonth'];
        this.timesheet = this.options['timesheet'];
    },
    render: function() {
        this.$el.addClass('week');
        this.$el.append($(_.template($('#week-template').html(), {
            weekStart: this.weekStart,
            weekEnd: this.weekEnd
        })));
        _.each(this.models, function(entry) {
            var row = new EntryRow({ model: entry });
            entry.row = row;
            row.render().$el.insertBefore(this.$el.find('tbody tr.week-summary'));
        }, this);
        this.updateTotalHours();
        return this;
    },

    // === Custom Methods === //

    approveWeek: function(event) {
        event.preventDefault();
        var msg = "All verified entries from the week of " +
                displayDate(this.weekStart) + " are now approved.",
            entryIds = getIdsFromCurrentMonth(this.models);
        approveEntries(this.collection, entryIds, msg);
    },
    rejectWeek: function(event) {
        event.preventDefault();
        var msg = "All entries from the week of " +
                displayDate(this.weekStart) + " are now unverified.",
            entryIds = getIdsFromCurrentMonth(this.models);
        rejectEntries(this.collection, entryIds, msg);
    },
    updateTotalHours: function() {
        this.totalHours = 0;
        _.each(this.models, function(entry) {
            this.totalHours += entry.get("total_seconds");
        }, this);
        this.$el.find(".week-summary .total-hours").text(formatHoursMinutes(this.totalHours));
        if (this.models.length > 0) {
            this.$el.find(".hide-if-empty").attr({style: ""});
            this.$el.find(".show-if-empty").attr({style: "display:none;"});
        } else {
            this.$el.find(".hide-if-empty").attr({style: "display:none;"});
            this.$el.find(".show-if-empty").attr({style: ""});
        }
    },
    verifyWeek: function(event) {
        event.preventDefault();
        var msg = "All entries from the week of " +
                displayDate(this.weekStart) + " are now verified.",
            entryIds = getIdsFromCurrentMonth(this.models);
        verifyEntries(this.collection, entryIds, msg);
    }
});


var Timesheet = Backbone.View.extend({
    el: "body",
    events: {
        "click .btn[title='Verify All']": "verifyMonth",
        "click .btn[title='Approve All']": "approveMonth",
        "click .btn[title='Reject All']": "rejectMonth",
        "click a[title='Add Entry']": "createEntry",
        "click .btn.last-month": "",
        "click .btn.next-month": "",
        "click .btn.refresh": "",
        "change #filter-entries select": "filterEntries"
    },
    initialize: function() {
        this.thisMonth = this.options['thisMonth'];
        this.nextMonth = this.options['nextMonth'];
        this.lastMonth = this.options['lastMonth'];
        this.weekTables = [];
        this.modal = new Modal();

        // Create a table view for each week of the month.
        _.each(this.options['weekRanges'], function(range) {
            this.weekTables.push(new WeekTable({
                collection: this.collection,  // Pass for reference.
                models: [],  // The entries which are a part of the week.
                thisMonth: this.thisMonth,
                nextMonth: this.nextMonth,
                lastMonth: this.lastMonth,
                weekStart: new Date(range[0]),
                weekEnd: new Date(range[1]),
                timesheet: this
            }));
        }, this);

        // Split entries by week.
        // (Assumes that entries are in ascending order by end_time.)
        var weekCursor = entryCursor = 0;
        for (entryCursor; entryCursor < this.collection.length;) {
            if (weekCursor >= this.weekTables.length) { break; }

            var weekTable = this.weekTables[weekCursor],
                entry = this.collection.at(entryCursor);
                date = entry.getEndTime();

            if (date > weekTable.weekEnd) { weekCursor++; }
            else if (date < weekTable.weekStart) { entryCursor++; }
            else {
                entry.weekTable = weekTable;  // Store table on entry.
                weekTable.models.push(entry);
                entryCursor++;
            }
        }

        // Render the table for each week, and render the modal.
        _.each(this.weekTables, function(weekTable) {
            $('#all-entries').append(weekTable.render().el);
        }, this)
        this.$el.append(this.modal.render());
        this.updateProjects();
    },
    render: function() {
        return this;
    },

    // === Custom Methods === //

    addEntryToTimesheet: function(newEntry) {
        // Adds entry to the correct week table & place within the table.
        var newEndTime = newEntry.getEndTime();

        // Find the week which contains the newEndTime.
        var weekTable = _.find(this.weekTables, function(weekTable) {
            return newEndTime >= weekTable.weekStart && newEndTime <= weekTable.weekEnd;
        });
        newEntry.weekTable = weekTable;

        // If no week is found, entry is from either before or after this
        // month.
        if (!weekTable) { return false; }

        // Otherwise, find the first entry in the week whose end time is
        // larger than the newEndTime - the new entry should be inserted
        // before this entry.
        found = _.find(weekTable.models, function(old_entry, index, models) {
            if (old_entry.getEndTime() > newEndTime) {
                // Add newEntry to the weekTable, and render it.
                var newEntry = this;
                models.splice(index, 0, newEntry);
                var row = new EntryRow({ model: newEntry });
                newEntry.row = row;
                row.render().$el.insertBefore(row.model.weekTable.$el.find("tbody tr#" + old_entry.row.getTagId()));
                return true;
            }
            return false;
        }, newEntry); // bind to newEntry

        timesheet.collection.add(newEntry)

        // If no such entry was found, then the entry should be inserted at
        // the end of the table.
        if (!found) {
            weekTable.models.push(newEntry);
            var row = new EntryRow({model: newEntry});
            newEntry.row = row;
            row.render().$el.insertBefore(row.model.weekTable.$el.find("tbody tr.week-summary"));
        }

        return true;
    },
    approveMonth: function(event) {
        event.preventDefault();
        var msg = "All verified entries from the month of " +
                fullMonths[this.thisMonth.getMonth()] + " are now approved.",
            entryIds = getIdsFromCurrentMonth(this.collection.toArray());
        approveEntries(this.collection, entryIds, msg);
    },
    createEntry: function(event) {
        event.preventDefault();
        $.ajax({
            url: createEntryUrl,
            dataType: 'html'
        }).done(function(data, status, xhr) {
            timesheet.modal.setTitle("Add Entry");
            timesheet.modal.setContent(data);
            initializeDatepickers();  // For start and end dates.
            var onSubmit = function(event) {
                event.preventDefault();
                $.ajax({
                    type: "POST",
                    url: createEntryUrl,
                    data: $(this).serialize(),
                    success: function(data, status, xhr) {
                        var entry = new Entry(data);
                        var added = timesheet.addEntryToTimesheet(entry);
                        timesheet.modal.hide();
                        if (added) {
                            timesheet.updateProjects();
                            entry.weekTable.updateTotalHours();
                            showSuccess(entry.description() + " has been created.");
                        } else {
                            showSuccess(entry.description() + " has been added to " +
                                    fullMonths[entry.getEndTime().getMonth()] + ".");
                        }
                    },
                    error: function(xhr, status, error) {
                        if (xhr.status === 400) {
                            timesheet.modal.setContent(xhr.responseText);
                            initializeDatepickers();  // For start and end dates.
                            timesheet.modal.$el.find('form').on('submit', onSubmit);
                            return;
                        }
                        return handleAjaxFailure(xhr, status, error);
                    }
                });
            };
            timesheet.modal.$el.find('form').on('submit', onSubmit);
            timesheet.modal.show();
        }).fail(handleAjaxFailure);
    },
    filterEntries: function(event) {
        // TODO
    },
    rejectMonth: function(event) {
        event.preventDefault();
        var msg = "All entries from the month of " +
                fullMonths[this.thisMonth.getMonth()] + " are now unverified.",
            entryIds = getIdsFromCurrentMonth(this.collection.toArray());
        rejectEntries(this.collection, entryIds, msg);
    },
    updateProjects: function(event) {
        // Maintain the "Filter by projects" dropdown menu.

        // Find all current projects.
        projects = {};
        _.each(this.collection.models, function(entry) {
            projects[entry.get("project__id")] = entry.get("project__name")
        }, this);

        // Create a sorted list of options.
        var options = [];
        for (var project_id in projects) {
            name = projects[project_id];
            options.push($("<option />").attr({value: project_id}).html(name));
        }
        options = _.sortBy(options, function(option) { return option.html().toLowerCase(); });
        options.splice(0, 0, $("<option />").attr({value: ""}).html("By project..."));

        // Build a brand new select.
        var oldSelect = this.$el.find("#filter-entries [name='project']")
        var newSelect = $("<select>").attr({name: "project", id: "filter-entries"});
        _.each(options, function(option) {
            this.append(option);
        }, newSelect)

        // Retain the old selected option if possible.
        var selected = oldSelect.find(":selected");
        if (selected) {
            val = selected[0].value;
            newSelect.find("[value='" + val + "']").attr({selected: "true"});
        }

        oldSelect.replaceWith(newSelect);
    },
    verifyMonth: function(event) {
        event.preventDefault();
        var msg = "All entries from the month of " +
                fullMonths[this.thisMonth.getMonth()] + " are now verified.",
            entryIds = getIdsFromCurrentMonth(this.collection.toArray());
        verifyEntries(this.collection, entryIds, msg);
    }
});


var Modal = Backbone.View.extend({
    tagName: "div",
    initialize: function() {
        this.$el.addClass("modal hide fade");
        this.template = _.template($("#modal-template").html());
        this.modalTitle = "";
        this.modalContent = "";
        this.render();
    },
    render: function() {
        this.$el.html(this.template({
            "modalTitle": this.modalTitle,
            "modalContent": this.modalContent
        }));
        return this.$el;
    },

    // === Custom Methods === //

    hide: function() {
        this.$el.modal('hide');
    },
    setContent: function(content) {
        this.modalContent = content;
        this.render();
    },
    setTitle: function(title) {
        this.modalTitle = title;
        this.render();
    },
    show: function() {
        this.$el.modal('show');
    }
})
