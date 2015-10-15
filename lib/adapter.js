'use strict';

// Public dependencies
const _ = require('lodash');
const GraphQL = require('graphql');

module.exports = {
  /*
   * Test
   */
  getGraphQLSchema: function (collections) {
    const deferred = Promise.defer();

    const self = this;

    if (_.isEmpty(collections)) {
      return cb('Error: Empty object collections');
    }

    Promise.all([
      self.getQueries(collections),
      self.getMutations(collections)
      ])
      .then(function (results) {
        const Query = _.first(results);
        const Mutation = _.last(results);

        const Schema = new GraphQL.GraphQLSchema({
          query: Query,
          mutation: Mutation
        });

        deferred.resolve(Schema);
      })
      .catch(function (err) {
        console.log(err);
        deferred.reject(err);
      });

    return deferred.promise;
  },

  getQueries: function (collections) {
    const deferred = Promise.defer();

    const self = this;
    const arrayOfPromises = [];

    _.forEach(collections, function (collection, key) {
      arrayOfPromises.push(self.buildQuery(collection, key));
    });

    Promise.all(arrayOfPromises)
      .then(function (queries) {
        deferred.resolve([]);
      })
      .catch(function (err) {
        deferred.reject(err);
      });

    return deferred.promise;
  },

  getMutations: function (collections) {
    const deferred = Promise.defer();


    deferred.resolve([]);

    return deferred.promise;
  },

  buildQuery: function (collection, key) {
    const deferred = Promise.defer();

    console.log("Query: " + key);

    deferred.resolve();

    return deferred.promise;
  },

  buildMutation: function (collection, key) {
    const deferred = Promise.defer();

    console.log("Mutation: " + key);

    deferred.resolve();

    return deferred.promise;
  }
};
