import type { ModelSchema } from '../core/types.js';

export interface Person {
  userID: number;
  uniId: string;
  timeId: string;
  name: string;
  surname?: string;
  completeName?: string;
  age: number;
  ageString?: string;
  timeMap?: Map<string, Date>;
  revtimeMap?: Map<Date, string>;
  intMap?: Map<string, number>;
  intMapDefault?: Map<string, number>;
  stringMap?: Map<string, string>;
  timeList?: Date[];
  intList?: number[];
  stringList?: string[];
  stringListDefault?: string[];
  timeSet?: Set<Date>;
  intSet?: Set<number>;
  intSetDefault?: Set<number>;
  stringSet?: Set<string>;
  info?: Map<string, string>;
  phones?: string[];
  emails?: Set<string>;
  points: number;
  active: boolean;
  timestamp?: Date;
  auth_token?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const personSchema: ModelSchema = {
  fields: {
    userID: { type: 'int' },
    uniId: { type: 'uuid', default: { $db_function: 'uuid()' } },
    timeId: { type: 'timeuuid' },
    name: { type: 'varchar', default: 'no name provided' },
    surname: { type: 'varchar', default: 'no surname provided' },
    completeName: {
      type: 'varchar',
      default: function(this: Person) {
        let returnValue = this.name;
        if (this.surname) returnValue += ` ${this.surname}`;
        return returnValue;
      } as any,
    },
    age: {
      type: 'int',
      rule: (value: any) => typeof value === 'number' && value > 0,
    },
    ageString: {
      type: 'text',
      virtual: {
        get(this: Person) {
          return this.age?.toString();
        },
        set(this: Person, value: any) {
          this.age = parseInt(String(value), 10);
        },
      },
    },
    timeMap: {
      type: 'map',
      typeDef: '<text, timestamp>',
    },
    revtimeMap: {
      type: 'map',
      typeDef: '<timestamp, text>',
    },
    intMap: {
      type: 'map',
      typeDef: '<text, int>',
    },
    intMapDefault: {
      type: 'map',
      typeDef: '<text, int>',
      default: {
        one: 1,
        two: 2,
      },
    },
    stringMap: {
      type: 'map',
      typeDef: '<text, text>',
    },
    timeList: {
      type: 'list',
      typeDef: '<timestamp>',
    },
    intList: {
      type: 'list',
      typeDef: '<int>',
    },
    stringList: {
      type: 'list',
      typeDef: '<text>',
    },
    stringListDefault: {
      type: 'list',
      typeDef: '<text>',
      default: ['one', 'two'],
    },
    timeSet: {
      type: 'set',
      typeDef: '<timestamp>',
    },
    intSet: {
      type: 'set',
      typeDef: '<int>',
    },
    intSetDefault: {
      type: 'set',
      typeDef: '<int>',
      default: [1, 2],
    },
    stringSet: {
      type: 'set',
      typeDef: '<text>',
    },
    info: { type: 'map', typeDef: '<varchar,varchar>' },
    phones: { type: 'list', typeDef: '<varchar>' },
    emails: { type: 'set', typeDef: '<varchar>' },
    points: {
      type: 'double',
      rule: {
        required: true,
        validators: [
          {
            validator: (value: any) => typeof value === 'number' && value > 0,
            message: (value: any) => `points must be greater than 0, you provided ${value}`,
          },
          {
            validator: (value: any) => typeof value === 'number' && value < 100,
            message: 'points must be less than 100',
          },
        ],
      },
    },
    active: 'boolean',
    timestamp: 'timestamp',
    auth_token: 'varchar',
    createdAt: { type: 'timestamp', default: { $db_function: 'toTimestamp(now())' } },
  },
  key: [['userID'], 'age'],
  indexes: ['name', 'phones', 'emails', 'keys(info)', 'entries(info)', 'values(info)', 'created_at'],
  custom_indexes: [
    {
      on: 'name',
      using: 'org.apache.cassandra.index.sasi.SASIIndex',
      options: {
        mode: 'CONTAINS',
        analyzer_class: 'org.apache.cassandra.index.sasi.analyzer.NonTokenizingAnalyzer',
        case_sensitive: 'false',
      },
    },
  ],
  materialized_views: {
    mat_view_composite: {
      select: ['*'],
      key: [['userID', 'age'], 'active'],
    },
    mat_view_composite_options: {
      select: ['userID', 'age', 'createdAt'],
      key: [['userID', 'age'], 'createdAt'],
    },
    mat_view_composite_filters: {
      select: ['*'],
      key: [['userID', 'age'], 'active'],
      filters: {
        userID: { $gte: 10, $isnt: null },
        age: { $isnt: null },
        timeId: { $isnt: null },
        auth_token: { $isnt: null },
      },
    },
  },
  options: {
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
    versions: {
      key: '__v'
    },
    compaction: {
      class: 'SizeTieredCompactionStrategy',
    },
    gc_grace_seconds: 864000,
  },
  before_save: (instance: any) => {
    (instance as Person).active = true;
    return true;
  },
  after_save: (instance: any) => {
    console.log(`Person ${(instance as Person).name} saved successfully`);
    return true;
  },
  before_update: (query: any, updateValues: any) => {
    console.log('Before update:', query, updateValues);
    return true;
  },
  after_update: (query: any, updateValues: any) => {
    console.log('After update:', query, updateValues);
    return true;
  },
  before_delete: (query: any) => {
    console.log('Before delete:', query);
    return true;
  },
  after_delete: (query: any) => {
    console.log('After delete:', query);
    return true;
  },
  methods: {
    getName(this: Person): string {
      return this.name;
    },
    getFullName(this: Person): string {
      return `${this.name} ${this.surname || ''}`.trim();
    },
    isAdult(this: Person): boolean {
      return this.age >= 18;
    },
  },
};
