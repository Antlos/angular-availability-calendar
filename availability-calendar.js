(function () {
'use strict';

// TODO: document everything
// TODO: check that https://github.com/johnpapa/angular-styleguide is followed
angular.module('availability-calendar', [])

.constant('availabilityCalendarConfig', {
	wrapperTemplate: '<div class="availability-calendar"></div>',
	prevButtonTemplate: '<a href="" class="availability-calendar-prev-button">&lt;</a>',
	nextButtonTemplate: '<a href="" class="availability-calendar-next-button">&gt;</a>',
	titleTemplate: '<div class="availability-calendar-title"></div>',
	monthSelectTemplate: '<select class="availability-calendar-month-select"></select>',
	yearSelectTemplate: '<select class="availability-calendar-year-select"></select>',
	calendarTableTemplate: '<table class="availability-calendar-table"></table>',
	calendarHeaderTemplate: '<thead></thead>',
	calendarHeaderRowTemplate: '<tr></tr>',
	calendarHeaderCellTemplate: '<th></th>',
	calendarBodyTemplate: '<tbody></tbody>',
	calendarBodyRowTemplate: '<tr></tr>',
	calendarBodyCellTemplate: '<td></td>',
	calendarBodyCellLabelTemplate: '<span class="availability-calendar-day-label"></span>',
	wrapperLoadingClass: 'loading',
	disabledDayClass: 'disabled',
	defaultDayDecorations: {
		available: true
	},
	decorateHandlers: {
		'disabled': function (val, el, date) {
			if (val) {
				el.addClass('disabled');
			}
		},
		'available': function (val, el, date) {
			if (val) {
				el.addClass('available');
			}
		},
		'class': function (val, el, date) {
			var c = val;
			if (angular.isArray(val)) {
				c = val.join(' ');
			}
			if (c) {
				el.addClass(c);
			}
		}
	},
})

// # availability-date component
// Requires moment.js and display a monthly calendar that shows availabilty dates.
.directive('availabilityCalendar', availabilityCalendarDirective);

function availabilityCalendarDirective () {
	return {
		restrict: 'EA',
		require: ['availabilityCalendar', '?ngModel'],
		scope: {
			ngModel: '=',
			// - `on-load` is an (optional) expression that will receive a `$calendar`
			//   local variable containing a reference to the calendar controller.
			onLoad: '&',
			// - `fetch-dates` is an (optional) expression that may return a promise
			//   to fetch custom data. Local variables are `$fromDate` and `$toDate`
			//   which indicate the time period between which data should be fetched.
			//   Additionaly a `$fetchOptions` with user options passed to the calendar
			//   controller's `updateCalendar` method are provided.
			fetchDates: '&',
			// - `decorate-date` is an (optional) expression that may return an object
			//   with custom properties for the given date view. This object will be
			//   used by decoration handlers (see `decorateHandlers` configuration and
			//   `decorate-handlers`) to decorate the DOM element for the date.
			//   Local variables are available with `$date` as the date of the day to
			//   consider and `$fetchedData` with the result of `fetch-dates` for a
			//   range containing the given date.
			decorateDate: '&',
			// - `decorate-handlers` is an (optional) expression that may return an
			//   object to extend default configuration `decorateHandlers`. The object
			//   keys will be used to handle a specific decorators; values should be
			//   a function(decoratorValue, dateDomElement, date) which decorates the
			//   provided DOM element.
			decorateHandlers: '&',
			// - `availability-calendar-options` in an expression that should return
			//   an object that may contain this options:
			//   - `showOn`: Either `null` to show the calendar always or a DOM event
			//     name to show the calendar when triggered on the element.
			//   - `hideOn`: Either `null` to never hide the calendar or a DOM event
			//     name to hide the calendar when triggered on the element.
			//   - `appendTo`: A string of value `'body'` or `'element'` that indicates
			//     where to append the calendar.
			//   - `position`: TODO
			//   - `onSelectFocus`: an id or element to focus after a selction has been
			//     made. If `null` the input will be blurred.
			availabilityCalendarOptions: '&',
			// - `selectable-month` (optional) if defined, it indicates wether the month
			//   and year label should be selectable.
			// - `on-date-<event>` are (optional) expressions that will be attached to
			//   each enabled date DOM element when the DOM `<event>` is triggered.
		},
		controller: availabilityCalendarController,
		controllerAs: 'ctrl',
		bindToController: true,
		link: availabilityCalendarLink,
	};
}

function availabilityCalendarController ($scope, $element, $attrs, $q, $animate, $locale, $parse, availabilityCalendarConfig) {
	var ctrl = this;
	var startMoment, endMoment;
	var decorateHandlers = angular.extend({},
		availabilityCalendarConfig.decorateHandlers,
		ctrl.decorateHandlers()
	);
	var dateEvents = [];
	var originalCalendarBodyCellClass = ''; // TODO this restore a day element class to its original one. shold be done for each attribute
	var calendarElements = buildCalendar({
		calendar: generateElement('wrapper'),
		prevButton: generateElement('prevButton', true),
		nextButton: generateElement('nextButton', true),
		title: generateElement('title', true),
		// monthSlect: a selectMonthTemplate element
		// yearSelect: a selectYearTemplate element
		table: generateElement('calendarTable'),
		header: generateElement('calendarHeader', true),
		// headerRow: one calendarBodyRowTemplate element inserted into header
		// headerCells: array of 7 calendarHeaderCellTemplate elements inserted into headerRow
		body: generateElement('calendarBody'),
		// weeks: array of 6 calendarBodyRowTemplate elements inserted into body
		// days: array of 42 calendarBodyCellTemplate elements inserted into weeks
		// weekDays: two dimensional array with 5 (weeks) * 7 days
		// dayLabels: array of 42 calendarBodyCellLabelTemplate elements not inserted
	});
	ctrl.setMonthDate = setMonthDate;
	ctrl.nextMonth = nextMonth;
	ctrl.prevMonth = prevMonth;
	ctrl.updateCalendar = updateCalendar;
	ctrl.addDateEvent = addDateEvent;
	ctrl.hideCalendar = hideCalendar;
	ctrl.parseMoment = parseMoment;
	ctrl.getDecoratedDays = getDecoratedDays;

	// Calendar options

	var defaultOptions = {};
	// Attribute directive
	if (angular.isDefined($attrs.availabilityCalendar)) {
		ctrl.options = angular.extend({
			showOn: 'focus',
			hideOn: 'blur',
			appendTo: 'body',
			position: 'bottom left'
		}, ctrl.availabilityCalendarOptions());
	}
	// Element directive
	else {
		ctrl.options = angular.extend({
			showOn: null,
			hideOn: null,
			appendTo: 'element'
		}, ctrl.availabilityCalendarOptions());
	}

	// Initialize calendar

	addDateEventsFromAttrs();

	if (ctrl.options.showOn) {
		$element.on(ctrl.options.showOn, function () {
			showCalendar(ctrl.options.appendTo, ctrl.options.position);
		});
	}
	else {
		showCalendar(ctrl.options.appendTo, ctrl.options.position);
	}

	if (ctrl.options.hideOn) {
		$element.on(ctrl.options.hideOn, hideCalendar);
	}

	$scope.$on('$destroy', hideCalendar);

	ctrl.onLoad({
		'$calendar': ctrl
	});

	// Calendar generation

	function buildCalendar (els) {
		var weekEl, dayEl;
		els.calendar
			.append(els.prevButton)
			.append(els.nextButton)
			.append(els.title)
			.append(els.table);
		if (angular.isDefined($attrs.selectableMonth)) {
			els.monthSelect = generateMonthSelectElement(),
			els.title.append(els.monthSelect);
			els.yearSelect = generateYearSelectElement(),
			els.title.append(els.yearSelect);
		}
		if (els.header) {
			els.table.append(els.header);
			els.headerRow = generateElement('calendarHeaderRow');
			els.header.append(els.headerRow);
			els.headerCells = [];
			for (var i = 0; i < 7; i++) {
				dayEl = generateElement('calendarHeaderCell');
				// TODO use option for SHORTDAY / DAY
				dayEl.html($locale.DATETIME_FORMATS.SHORTDAY[i]);
				els.headerCells.push(dayEl);
				els.headerRow.append(dayEl);
			}
		}
		els.table.append(els.body);
		els.weeks = [];
		els.days = [];
		els.weekDays = [];
		els.dayLabels = [];
		for (var w = 0; w < 6; w++) {
			weekEl = generateElement('calendarBodyRow');
			els.weeks.push(weekEl);
			els.body.append(weekEl);
			els.weekDays.push([]);
			for (var i = 0; i < 7; i++) {
				dayEl = generateElement('calendarBodyCell');
				els.days.push(dayEl);
				els.weekDays[w].push(dayEl);
				els.weeks[w].append(dayEl);

				els.dayLabels.push(generateElement('calendarBodyCellLabel'));
			}
		}
		originalCalendarBodyCellClass = dayEl.attr('class') || '';
		return els;
	}

	function generateElement (templateName, optional) {
		var templateId = templateName + 'Template';
		if (!availabilityCalendarConfig[templateId]) {
			if (!optional) {
				throw new Error('availabilty-calendar: Template not cofigured for: ' + templateName);
			}
			else {
				return null;
			}
		}
		return angular.element(availabilityCalendarConfig[templateId]);
	}

	function generateMonthSelectElement () {
		var element = generateElement('monthSelect', true);
		element.on('change', function (event) {
			setMonthDate(moment([startMoment.year(), event.target.value, 1]));
		});
		angular.forEach($locale.DATETIME_FORMATS.MONTH, function (month, i) {
			element.append('<option value="' + i + '">' + month + '</option>');
		});
		return element;
	}

	function generateYearSelectElement () {
		var element = generateElement('yearSelect', true);
		element.on('change', function (event) {
			setMonthDate(moment([event.target.value, startMoment.month(), 1]));
		});
		// TODO consider min/max dates
		var year = (new Date()).getFullYear();
		for (; year > 1970; --year) {
			element.append('<option value="' + year + '">' + year + '</option>');
		}
		return element;
	}

	function addDateEventsFromAttrs () {
		var result = [];
		for (var key in $attrs) {
			if (key.substr(0, 6) !== 'onDate') {
				continue;
			}
			addDateEvent(
				key.substr(6).toLowerCase(),
				(function(customHandler) {
					return function (e) {
						return customHandler($scope.$parent, {
							'$event': e,
							'$date':e.calendarDate,
							'$decorations': e.calendarDateDecorations,
							'$calendar': ctrl
						});
					};
				})($parse($attrs[key]))
			);
		}
		return result;
	}

	function addDateEvent (name, handler) {
		dateEvents.push({
			eventName: name,
			handler: function (e) {
				var el = angular.element(e.target);
				while (el && !el.data('$availabilityCalendarDate')) {
					el = el.parent();
				}
				e.calendarDate = el.data('$availabilityCalendarDate');
				e.calendarDateDecorations = el.data('$availabilityCalendarDateDecorations')
				return handler(e);
			}
		});
	}

	function attachEventsToDate (eventsObject, day) {
		angular.forEach(eventsObject, function (e) {
			day.on(e.eventName, e.handler);
		});
	}

	// Calendar update

	function setMonthDate (date) {
		if (!date || !parseMoment(date).isValid()) {
			return;
		}
		startMoment = parseMoment(date).startOf('month');
		endMoment = startMoment.clone().endOf('month');
		updateCalendarTitle(date);
		return updateCalendar(startMoment, endMoment);
	}

	function updateCalendarTitle (date) {
		var dateMoment = parseMoment(date);
		if (calendarElements.monthSelect) {
			calendarElements.monthSelect.val(dateMoment.month());
			calendarElements.yearSelect.val(dateMoment.year());
		}
		else {
			// TODO generate title from expression?
			calendarElements.title.html(
				$locale.DATETIME_FORMATS.MONTH[dateMoment.month()] +
				', ' +
				dateMoment.year()
			);
		}
	}

	function getDecoratedDays (startDate, endDate, fetchOptions) {
		// assert startMoment < endMoment
		var fromMoment = startDate ? parseMoment(startDate) : startMoment;
		var toMoment = endDate ? parseMoment(endDate) : endMoment;
		if (!fromMoment || !toMoment || fromMoment.isAfter(toMoment)) {
			return $q.when(null);
		}
		fromMoment = fromMoment.clone();
		toMoment = toMoment.clone();
		// Chain promises
		var lastPromise;
		if (getDecoratedDays.$lastPromise) {
			lastPromise = getDecoratedDays.$lastPromise.catch(function () {
				return null;
			});
		}
		else {
			lastPromise = $q.when(null);
		}
		// Cache last promise
		return getDecoratedDays.$lastPromise = lastPromise
		// Actual fetch
		.then(function () {
			return $q.when(ctrl.fetchDates({
				'$fromDate': fromMoment.clone().toDate(),
				'$toDate': toMoment.clone().toDate(),
				'$fetchOptions': fetchOptions
			}));
		})
		// Generate decorations
		.then(function (fetchedData) {
			var dayDecorations = [], dayDate;
			var currentMoment = fromMoment.clone();
			do {
				// Decorate day element
				dayDate = currentMoment.clone().toDate();
				dayDecorations.push(angular.extend(
					{},
					availabilityCalendarConfig.defaultDayDecorations,
					ctrl.decorateDate({
						'$date': dayDate,
						'$fetchedData': fetchedData
					}),
					{
						$date: dayDate
					}
				));
				// Next day
				currentMoment.add(1, 'day');
			} while (!currentMoment.isAfter(toMoment, 'day'));
			dayDecorations.$fetchedData = fetchedData;
			return dayDecorations;
		});
	}

	function updateCalendar (startDate, endDate, fetchOptions) {
		startLoading();
		return getDecoratedDays(startDate, endDate, fetchOptions)
		.then(function (decorations) {
			return populateCalendarAfterFetch(decorations);
		})
		// TODO on error?
		.finally(function () {
			stopLoading();
		});
	}

	function populateCalendarAfterFetch (decorations) {
		var weekNumber = 0, weekEl, dayEl, dayLabelEl, dayDate, decorationIndex = 0, decoration;
		// Empty calendar elements
		for (var i = calendarElements.days.length - 1; i >= 0; i--) {
			calendarElements.days[i]
				.html('')
				.attr('class', originalCalendarBodyCellClass)
				.addClass(availabilityCalendarConfig.disabledDayClass);
		}
		calendarElements.body.html('');
		// Add calendar elements
		for (
			var currentMoment = startMoment.clone();
			!currentMoment.isAfter(endMoment, 'day');
			currentMoment.add(1, 'day')
		) {
			dayDate = currentMoment.clone().toDate();
			// Add week to calendar
			if (!weekEl) {
				weekEl = calendarElements.weeks[weekNumber];
				calendarElements.body.append(weekEl);
				// Attach days
				if (weekEl.children().length < 7) {
					for (var i = 0; i < 7; i++) {
						weekEl.append(calendarElements.weekDays[weekNumber][i]);
					}
				}
			}
			// Prepare day cell element
			dayEl = calendarElements.weekDays[weekNumber][currentMoment.day()];
			dayEl.removeClass(availabilityCalendarConfig.disabledDayClass);
			attachEventsToDate(dateEvents, dayEl);
			// Apply decorations
			if (decorations
					&& decorations.length > decorationIndex
					&& currentMoment.isSame(decorations[decorationIndex].$date, 'day')) {
				decoration = decorations[decorationIndex];
				decorationIndex++;
			}
			else {
				decoration = angular.extend(
					{},
					availabilityCalendarConfig.defaultDayDecorations,
					ctrl.decorateDate({
						'$date': dayDate,
						'$fetchedData': (decorations && decorations.$fetchedData)
					})
				);
			}
			applyDecorations(decoration, dayEl, dayDate);
			// Add event additional data
			dayEl.data('$availabilityCalendarDate', dayDate);
			dayEl.data('$availabilityCalendarDateDecorations', decoration);
			// Add day label
			dayLabelEl = calendarElements.dayLabels[currentMoment.date()];
			dayLabelEl.html(currentMoment.date());
			dayEl.append(dayLabelEl);
			// Move to next week of the month
			if (currentMoment.day() === 6) {
				weekNumber++;
				weekEl = null;
			}
		}
	}

	function applyDecorations (dayDecorations, dayEl, date) {
		angular.forEach(dayDecorations, function (decorator, name) {
			if (typeof decorateHandlers[name] !== 'function') {
				return;
			}
			decorateHandlers[name](decorator, dayEl, date);
		});
	}

	// Utility functions

	function showCalendar (appendTo, position) {
		var containerElement = appendTo;
		// Show
		if (appendTo === 'body') {
			containerElement = document.getElementsByTagName('body');
		}
		else if (appendTo === 'element') {
			containerElement = $element;
		}
		angular
			.element(containerElement)
			.append(calendarElements.calendar);
		updateCalendar();
		// Add calendar classes
		if (ctrl.options.classes) {
			calendarElements.calendar.addClass(ctrl.options.classes);
		}
		// Add calendar events
		calendarElements.prevButton.on('click', prevMonth);
		calendarElements.nextButton.on('click', nextMonth);
		// Stop calendar event propagation
		if (appendTo !== 'element') {
			calendarElements.calendar.on('mousedown', function (e) {
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();
			});
		}
		// Position
		if (position) {
			positionCalendarHandler.$position = position;
			positionCalendarHandler();
			angular.element(window).on('resize', positionCalendarHandler);
		}
	}

	function positionCalendarHandler () {
		var position = positionCalendarHandler.$position;
		if (!position) {
			return;
		}
		var pos = {};
		var calendarPosition = getElementPosition($element);
		angular.forEach(position.split(' '), function (p) {
			switch (p) {
			case 'bottom':
				pos.top = (calendarPosition.top + $element[0].offsetHeight) + 'px';
				break;
			case 'top':
				pos.bottom = calendarPosition.top + 'px';
				break;
			case 'left':
				pos.left = calendarPosition.left + 'px';
				break;
			case 'right':
				pos.left = (calendarPosition.left - (calendarElements.calendar[0].offsetWidth - $element[0].offsetWidth)) + 'px';
				break;
			}
		});
		calendarElements.calendar.css(pos);
	}

	function hideCalendar () {
		calendarElements.calendar.remove();
		angular.element(window).off('resize', positionCalendarHandler);
	}

	function startLoading () {
		$animate.addClass(
			calendarElements.calendar,
			availabilityCalendarConfig.wrapperLoadingClass
		);
	}

	function stopLoading () {
		$animate.removeClass(
			calendarElements.calendar,
			availabilityCalendarConfig.wrapperLoadingClass
		);
	}

	function nextMonth (event) {
		if (event) {
			event.preventDefault();
		}
		var date = startMoment.clone().add(1, 'month').toDate();
		setMonthDate(date);
		return false;
	}

	function prevMonth (event) {
		if (event) {
			event.preventDefault();
		}
		var date = startMoment.clone().subtract(1, 'month').toDate();
		setMonthDate(date);
		return false;
	}

	function getElementPosition (element) {
		var el = angular.element(element)[0];
		var position = {
			left: 0,
			top: 0
		};
		while(el) {
			position.left += (el.offsetLeft + el.clientLeft);
			position.top += (el.offsetTop + el.clientTop);
			el = el.offsetParent;
		}
		return position;
	}

	// Moment utilities

	function parseMoment (date) {
		if (angular.isString(date)) {
			return moment(date,
				ctrl.options.dateFormat || moment.localeData().longDateFormat('L'),
				ctrl.options.dateLocale || moment.locale(),
				true);
		}
		return moment(date);
	}
}

availabilityCalendarController.$inject = [
	'$scope',
	'$element',
	'$attrs',
	'$q',
	'$animate',
	'$locale',
	'$parse',
	'availabilityCalendarConfig'
];

function availabilityCalendarLink (scope, element, attrs, ctrls) {
	var ctrl = ctrls[0];
	var ngModel = ctrls[1];

	if (ngModel) {
		ngModel.$validators.validDate = function (modelValue, viewValue) {
			var value = viewValue || modelValue;
			return ctrl.parseMoment(value).isValid();
		};
		if (angular.isDefined(attrs.availabilityCalendarValidate)) {
			ngModel.$asyncValidators.availableDate = function (modelValue, viewValue) {
				var value = viewValue || modelValue;
				var dateMoment = ctrl.parseMoment(value);
				return ctrl.getDecoratedDays(dateMoment, dateMoment, { validator: true }).then(function (decorations) {
					if (!decorations || decorations.length < 1 || !dateMoment.isSame(decorations[0].date)) {
						return false;
					}
					return !!decorations[0].available;
				})
			};
		}
		ngModel.$parsers.push(function (value) {
			if (!value) {
				return;
			}
			var date = ctrl.parseMoment(value).toDate();
			return date;
		});
		ngModel.$formatters.push(function (value) {
			if (value) {
				var format = ctrl.options.dateFormat;
				if (angular.isArray(format) && format.length) {
					format = format[0];
				}
				return ctrl.parseMoment(value).format(format || moment.localeData().longDateFormat('L'));
			}
		});
		scope.$watch('ctrl.ngModel', function (value) {
			ctrl.setMonthDate(value || new Date());
		});
		// on click change model value
		ctrl.addDateEvent('click', function (e) {
			if (e.calendarDate && e.calendarDateDecorations && e.calendarDateDecorations.available) {
				scope.$apply(function() {
					scope.ctrl.ngModel = e.calendarDate;
					// Change focus on select
					if (angular.isDefined(ctrl.options.onSelectFocus)) {
						setTimeout(function () {
							if (ctrl.options.onSelectFocus) {
								document.getElementById(ctrl.options.onSelectFocus).focus();
							}
							else {
								element[0].blur();
							}
						});
					}
				});
			}
		});
		// Placeholder
		if (!element.attr('placeholder')) {
			element.attr('placeholder', moment.localeData().longDateFormat('L'));
		}
	}
	else {
		ctrl.setMonthDate(new Date());
	}
}

})();
