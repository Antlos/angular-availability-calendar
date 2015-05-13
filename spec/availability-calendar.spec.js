'use strict';

describe('availability-calendar', function() {

	var $compile, $rootScope;

	beforeEach(function () {
		module('availability-calendar');

		inject(function ($injector) {
			$compile = $injector.get('$compile');
			$rootScope = $injector.get('$rootScope');
		});
	});

	describe('calendar', function() {

		it('gets generated', function() {
			var scope = $rootScope.$new();
			var element = $compile('<availability-calendar></availability-calendar>')(scope);
			expect(element.html()).not.to.be.empty;
		});

	});

});