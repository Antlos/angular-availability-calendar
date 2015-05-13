'use strict';

module.exports = function (grunt) {

  // Load grunt tasks automatically
  require('load-grunt-tasks')(grunt);

  // Define the configuration for all the tasks
  grunt.initConfig({

    uglify: {
      dist: {
        files: {
          'availability-calendar.min.js': [
            'availability-calendar.js'
          ]
        }
      }
    },

  });

  grunt.registerTask('test', [
    'karma'
  ]);

  grunt.registerTask('default', [
    'uglify',
  ]);
};
