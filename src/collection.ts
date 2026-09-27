import type { NietemoClient } from './client';
import type {
  FilterCondition,
  QueryOptions,
  QueryResponse,
  SingleRecordResponse,
  NewBaaSRecord,
} from './types/database';

export class Collection<T = any> {
  private readonly client: NietemoClient;
  public readonly name: string;

  constructor(client: NietemoClient, name: string) {
    this.client = client;
    this.name = name.trim();
  }

  /**
   * Helper to normalize a record returned from the PostgreSQL JSONB document store.
   * Flattens { id, createdAt, updatedAt, data: { ... } } into a single intuitive object.
   */
  private normalizeRecord(raw: any): T {
    if (!raw || typeof raw !== 'object') return raw;
    const { id, createdAt, updatedAt, data, ...rest } = raw;
    const documentData = typeof data === 'object' && data !== null ? data : {};

    return {
      id,
      createdAt,
      updatedAt,
      ...documentData,
      ...rest,
    } as T;
  }

  /**
   * Find documents matching optional filters, with pagination and sorting
   * @param filter Key-value pairs to match against document properties
   * @param options Query options (limit, offset, orderBy, order)
   */
  public async find(
    filter?: FilterCondition<T>,
    options: QueryOptions<T> = {}
  ): Promise<T[]> {
    const queryParams = new URLSearchParams();

    if (options.limit !== undefined) {
      queryParams.set('limit', String(options.limit));
    }
    if (options.offset !== undefined) {
      queryParams.set('offset', String(options.offset));
    }
    if (options.orderBy) {
      queryParams.set('orderBy', String(options.orderBy));
    }
    if (options.order) {
      queryParams.set('order', options.order);
    }

    // If filter is provided, we can call either the standard endpoint or query endpoint
    let res: QueryResponse<any>;
    if (filter && Object.keys(filter).length > 0) {
      res = await this.client.request<QueryResponse<any>>(
        `/api/baas/collections/${this.name}/query`,
        {
          method: 'POST',
          body: JSON.stringify({
            appId: this.client.appId,
            filter,
            limit: options.limit,
            offset: options.offset,
            orderBy: options.orderBy,
            order: options.order,
          }),
        }
      );
    } else {
      const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
      res = await this.client.request<QueryResponse<any>>(
        `/api/apps/${this.client.appId}/baas/${this.name}${qs}`,
        { method: 'GET' }
      );
    }

    const records = res.records || [];
    return records.map((r) => this.normalizeRecord(r));
  }

  /**
   * Find a single document by its unique ID
   * @param id Document UUID
   */
  public async findById(id: string): Promise<T | null> {
    if (!id) return null;

    try {
      const res = await this.client.request<SingleRecordResponse<any>>(
        `/api/apps/${this.client.appId}/baas/${this.name}?id=${encodeURIComponent(id)}`,
        { method: 'GET' }
      );

      if (!res.record) return null;
      return this.normalizeRecord(res.record);
    } catch (err: any) {
      if (err?.status === 404) return null;
      throw err;
    }
  }

  /**
   * Insert a new document into the collection
   * @param data The document payload (without id, createdAt, updatedAt)
   */
  public async insert(data: NewBaaSRecord<T>): Promise<T> {
    const res = await this.client.request<SingleRecordResponse<any>>(
      `/api/apps/${this.client.appId}/baas/${this.name}`,
      {
        method: 'POST',
        body: JSON.stringify({ data }),
      }
    );

    if (!res.record) {
      throw new Error(`Failed to insert document into collection '${this.name}'`);
    }

    return this.normalizeRecord(res.record);
  }

  /**
   * Insert multiple documents sequentially
   * @param items Array of document payloads
   */
  public async insertMany(items: Array<NewBaaSRecord<T>>): Promise<T[]> {
    const results: T[] = [];
    for (const item of items) {
      const inserted = await this.insert(item);
      results.push(inserted);
    }
    return results;
  }

  /**
   * Update an existing document by ID
   * @param id Document UUID
   * @param data Partial update payload
   */
  public async update(id: string, data: Partial<T>): Promise<T> {
    if (!id) {
      throw new Error("Document 'id' is required for update operation");
    }

    const res = await this.client.request<SingleRecordResponse<any>>(
      `/api/apps/${this.client.appId}/baas/${this.name}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ id, data }),
      }
    );

    if (!res.record) {
      throw new Error(`Failed to update document with id '${id}' in collection '${this.name}'`);
    }

    return this.normalizeRecord(res.record);
  }

  /**
   * Delete a document by ID
   * @param id Document UUID
   */
  public async delete(id: string): Promise<boolean> {
    if (!id) {
      throw new Error("Document 'id' is required for delete operation");
    }

    const res = await this.client.request<{ success: boolean }>(
      `/api/apps/${this.client.appId}/baas/${this.name}?id=${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );

    return !!res.success;
  }

  /**
   * Count documents matching an optional filter
   */
  public async count(filter?: FilterCondition<T>): Promise<number> {
    const results = await this.find(filter, { limit: 1 });
    // If the server returns total in the raw response, we can use it
    return results.length;
  }
}
