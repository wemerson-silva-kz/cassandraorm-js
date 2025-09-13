export interface ElasticsearchConfig {
  host: string;
  port?: number;
  auth?: {
    username: string;
    password: string;
  };
  ssl?: boolean;
}

export interface SearchQuery {
  index?: string;
  body: {
    query?: {
      match?: Record<string, string | number>;
      match_all?: Record<string, never>;
      term?: Record<string, string | number | boolean>;
      terms?: Record<string, Array<string | number | boolean>>;
      range?: Record<string, { 
        gte?: string | number | Date; 
        lte?: string | number | Date; 
        gt?: string | number | Date; 
        lt?: string | number | Date; 
      }>;
      bool?: {
        must?: SearchQuery['body']['query'][];
        should?: SearchQuery['body']['query'][];
        must_not?: SearchQuery['body']['query'][];
        filter?: SearchQuery['body']['query'][];
      };
    };
    sort?: Array<Record<string, 'asc' | 'desc' | { order: 'asc' | 'desc' }>>;
    size?: number;
    from?: number;
    _source?: string[] | boolean;
  };
}

export type ElasticsearchDocument = Record<string, string | number | boolean | Date | null | undefined | 
  Array<string | number | boolean> | Record<string, unknown>>;

export interface ElasticsearchResponse<T = ElasticsearchDocument> {
  hits: {
    total: { value: number; relation: string };
    hits: Array<{
      _index: string;
      _type: string;
      _id: string;
      _score: number;
      _source: T;
    }>;
  };
  took: number;
  timed_out: boolean;
}

export class ElassandraClient {
  private baseUrl: string;

  constructor(private config: ElasticsearchConfig) {
    const protocol = config.ssl ? 'https' : 'http';
    const port = config.port || 9200;
    this.baseUrl = `${protocol}://${config.host}:${port}`;
  }

  async search<T = ElasticsearchDocument>(query: SearchQuery): Promise<ElasticsearchResponse<T>> {
    const url = `${this.baseUrl}/${query.index || '_all'}/_search`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.auth) {
      const auth = btoa(`${this.config.auth.username}:${this.config.auth.password}`);
      headers.Authorization = `Basic ${auth}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(query.body),
    });

    if (!response.ok) {
      throw new Error(`Elasticsearch request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async index(indexName: string, doc: ElasticsearchDocument, id?: string): Promise<{ _id: string; _index: string; _type: string; result: string }> {
    const url = id 
      ? `${this.baseUrl}/${indexName}/_doc/${id}`
      : `${this.baseUrl}/${indexName}/_doc`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.auth) {
      const auth = btoa(`${this.config.auth.username}:${this.config.auth.password}`);
      headers.Authorization = `Basic ${auth}`;
    }

    const response = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers,
      body: JSON.stringify(doc),
    });

    if (!response.ok) {
      throw new Error(`Elasticsearch index request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async delete(indexName: string, id: string): Promise<{ _id: string; _index: string; _type: string; result: string }> {
    const url = `${this.baseUrl}/${indexName}/_doc/${id}`;

    const headers: Record<string, string> = {};

    if (this.config.auth) {
      const auth = btoa(`${this.config.auth.username}:${this.config.auth.password}`);
      headers.Authorization = `Basic ${auth}`;
    }

    const response = await fetch(url, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Elasticsearch delete request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async createIndex(indexName: string, mapping?: Record<string, unknown>): Promise<{ acknowledged: boolean; shards_acknowledged: boolean; index: string }> {
    const url = `${this.baseUrl}/${indexName}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.auth) {
      const auth = btoa(`${this.config.auth.username}:${this.config.auth.password}`);
      headers.Authorization = `Basic ${auth}`;
    }

    const body = mapping ? { mappings: mapping } : {};

    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Elasticsearch create index request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}
