'use strict';

// Public dependencies
const _ = require('lodash');
const GraphQL = require('graphql');
const GraphQLJson = require('./scalars/json');

module.exports = {
  /*
   * Defaults parameters object
   */
  defaults: {
    collections: {},
    usefulFunctions: true
  },

  /*
   * Starter to manage conversion process
   * and build valid GraphQL schemas
   *
   * @return {Object}
   */
  getGraphQLSchema: function (params, cb) {
    if (_.isEmpty(params.collections)) {
      return 'Error: Empty object collections';
    }

    // Set defaults properties
    this.defaults = _.defaults(params, this.defaults);

    const Query = this.getQueries();
    const Schema = new GraphQL.GraphQLSchema({
      query: Query
    });

    return cb(Schema);
  },

  /*
   * Manager to create queries for each collection
   *
   * @return {Boolean}
   */
  getQueries: function () {
    const self = this;

    // Create required keys
    this.defaults.types = {};
    this.defaults.queryFields = {};

    // Build Node Interface to expand compatibility
    this.buildNodeInterface();

    // Build GraphQL type system objects
    _.forEach(this.defaults.collections, function (collection, key) {
      self.buildType(collection, key);
    });

    // Build GraphQL query
    _.forEach(this.defaults.collections, function (collection, key) {
      self.buildQueryFields(collection, key);
    });

    // Build GraphQL query object
    return new GraphQL.GraphQLObjectType({
      name: 'Schema',
      description: 'Root of the Schema',
      fields: function () {
        return self.defaults.queryFields;
      }
    });
  },

  /*
   * Manager to create mutations for each collection
   *
   * @return {Boolean}
   */
  getMutations: function () {
    return false;
  },

  /*
   * Create GraphQL type system from Waterline collection
   */
  buildType: function (collection) {
    const self = this;
    const collectionIdentity = _.capitalize(collection.adapter.identity);
    const collectionAttributes = collection._attributes;

    const Type = new GraphQL.GraphQLObjectType({
      name: _.capitalize(collectionIdentity),
      description: 'This represents a/an ' + _.capitalize(collectionIdentity),
      interfaces: [self.defaults.node],
      fields: function () {
        const fields = {};

        _.forEach(collectionAttributes, function (rules, key) {
          if (rules.hasOwnProperty('model')) {
            fields[key] = {
              type: self.defaults.types[_.capitalize(rules.model)],
              resolve: function (object) {
                const criteria = {};
                criteria[collection.primaryKey] = object[key][self.defaults.collections[rules.model].primaryKey];

                return self.defaults.queryFields[rules.model.toLowerCase()].resolve(object, criteria);
              }
            };
          } else if (rules.hasOwnProperty('collection')) {
            fields[key] = {
              type: new GraphQL.GraphQLList(self.defaults.types[_.capitalize(rules.collection)]),
              resolve: function (object) {
                const criteria = {};
                criteria[rules.via.toLowerCase()] = object[collection.primaryKey];

                return self.defaults.queryFields[rules.collection.toLowerCase() + 's'].resolve(object, {}, {
                  where: criteria
                });
              }
            };
          } else {
            fields[key] = {
              type: rules.required ? new GraphQL.GraphQLNonNull(convertToGraphQLType(rules)) : convertToGraphQLType(rules)
            };
          }
        });

        // Handle interface
        fields.id = {
          type: new GraphQL.GraphQLNonNull(GraphQL.GraphQLString)
        };

        fields.type = {
          type: new GraphQL.GraphQLNonNull(GraphQL.GraphQLString)
        };

        return fields;
      }
    });

    // Save to global parameters
    this.defaults.types[collectionIdentity] = Type;
  },

  /*
   * Create query framework for each collection
   *
   * @return {Object}
   */
  buildQueryFields: function (collection) {
    const collectionIdentity = _.capitalize(collection.adapter.identity);
    const fields = {};

    // Get single record
    fields[collectionIdentity.toLowerCase()] = {
      type: this.defaults.types[collectionIdentity],
      args: {
        id: {
          name: 'id',
          type: new GraphQL.GraphQLNonNull(GraphQL.GraphQLString)
        }
      },
      resolve: function (object, criteria) {
        return collection.findOne(criteria).populateAll();
      }
    };

    // Get multiples records
    fields[collectionIdentity.toLowerCase() + 's'] = {
      type: new GraphQL.GraphQLList(this.defaults.types[collectionIdentity]),
      args: {
        limit: {
          name: 'limit',
          type: GraphQL.GraphQLInt
        },
        skip: {
          name: 'skip',
          type: GraphQL.GraphQLInt
        },
        sort: {
          name: 'sort',
          type: GraphQL.GraphQLString
        }
      },
      resolve: function (object, criteria, parent) {
        const filters = _.omit(handleDateFilter(criteria), function (value) {
          return _.isUndefined(value) || _.isNumber(value) ? _.isNull(value) : _.isEmpty(value);
        });

        return collection.find(filters).populateAll('', parent);
      }
    };

    if (this.defaults.usefulFunctions === true) {
      // Get latest records sorted by creation date
      fields['getLatest' + collectionIdentity + 's'] = {
        type: new GraphQL.GraphQLList(this.defaults.types[collectionIdentity]),
        args: {
          count: {
            name: 'count',
            type: new GraphQL.GraphQLNonNull(GraphQL.GraphQLInt)
          }
        },
        resolve: function (object, criteria) {
          const filters = _.omit(handleDateFilter(criteria), function (value) {
            return _.isUndefined(value) || _.isNumber(value) ? _.isNull(value) : _.isEmpty(value);
          });

          // Handle filters
          filters.sort = 'createdAt DESC';
          filters.limit = filters.count;

          delete filters.count;

          return collection.find(filters).populateAll();
        }
      };

      // Get first records sorted by creation date
      fields['getFirst' + collectionIdentity + 's'] = {
        type: new GraphQL.GraphQLList(this.defaults.types[collectionIdentity]),
        args: {
          count: {
            name: 'count',
            type: new GraphQL.GraphQLNonNull(GraphQL.GraphQLInt)
          }
        },
        resolve: function (object, criteria) {
          const filters = _.omit(handleDateFilter(criteria), function (value) {
            return _.isUndefined(value) || _.isNumber(value) ? _.isNull(value) : _.isEmpty(value);
          });

          // Handle filters
          filters.sort = 'createdAt ASC';
          filters.limit = filters.count;

          delete filters.count;

          return collection.find(filters).populateAll();
        }
      };

      // Get count of records
      fields['count' + collectionIdentity + 's'] = {
        type: GraphQL.GraphQLInt,
        resolve: function (object, criteria) {
          const filters = _.omit(handleDateFilter(criteria), function (value) {
            return _.isUndefined(value) || _.isNumber(value) ? _.isNull(value) : _.isEmpty(value);
          });

          return collection.count(filters);
        }
      };
    }

    // Apply date filters to each query
    _.forEach(_.omit(fields, collectionIdentity.toLowerCase()), function (field) {
      if (_.isEmpty(field.args)) {
        field.args = {};
      }

      field.args.start = {
        name: 'start',
        type: GraphQL.GraphQLString
      };

      field.args.end = {
        name: 'end',
        type: GraphQL.GraphQLString
      };
    });

    _.assign(this.defaults.queryFields, fields);
  },

  /*
   * Create functions to do the same as an API
   *
   * @return {Boolean}
   */
  buildMutation: function () {
    // TODO:
    // - Handle POST|PUT|DELETE request
    // - Use powerful Strapi blueprints
    // - Return structured Error

    return false;
  },

  buildNodeInterface: function () {
    const self = this;

    this.defaults.node = new GraphQL.GraphQLInterfaceType({
      name: 'Node',
      description: 'An object with an ID',
      fields: function fields() {
        return {
          id: {
            type: new GraphQL.GraphQLNonNull(GraphQL.GraphQLString),
            description: 'The global unique ID of an object'
          },
          type: {
            type: new GraphQL.GraphQLNonNull(GraphQL.GraphQLString),
            description: 'The type of the object'
          }
        };
      },
      resolveType: function resolveType(object) {
        return object.type;
      }
    });

    this.defaults.nodeFields = {
      name: 'Node',
      type: this.defaults.node,
      description: 'A node interface field',
      args: {
        id: {
          type: new GraphQL.GraphQLNonNull(GraphQL.GraphQLString),
          description: 'Id of node interface'
        }
      },
      resolve: function resolve(object, criteria) {
        const arrayOfPromises = [];

        // Search value in each collection
        _.forEach(self.defaults.collections, function (collection) {
          arrayOfPromises.push(collection.find(criteria));
        });

        return Promise.all(arrayOfPromises)
          .then(function (results) {
            let typeIndex;
            let object;

            _.forEach(results, function (value, index) {
              if (_.size(value) === 1) {
                // Save the index
                typeIndex = index;

                // Get object from array
                object = _.first(value);

                return false;
              }
            });

            object.type = self.defaults.queryFields[_.keys(self.defaults.queryFields)[typeIndex]].type;

            return object;
          })
          .catch(function (error) {
            return error;
          });
      }
    };
  }
};

// Helpers

/*
 * Convert Waterline type to GraphQL type system
 *
 * @return {Object}
 */
function convertToGraphQLType(rules) {
  switch (rules.type.toLowerCase()) {
    case 'string':
      return GraphQL.GraphQLString;
    case 'integer':
      return GraphQL.GraphQLInt;
    case 'boolean':
      return GraphQL.GraphQLBoolean;
    case 'float':
      return GraphQL.GraphQLFloat;
    case 'json':
      return GraphQLJson;
    default:
      return GraphQL.GraphQLString;
  }
}

/*
 * Convert GraphQL date argument to Waterline filters
 *
 * @return {Object}
 */
function handleDateFilter(filters) {
  filters.createdAt = {};

  if (!_.isEmpty(filters.start)) {
    filters.createdAt['>'] = new Date(filters.start);

    delete filters.start;
  }

  if (!_.isEmpty(filters.end)) {
    filters.createdAt['<'] = new Date(filters.end);

    delete filters.end;
  }

  return filters;
}
