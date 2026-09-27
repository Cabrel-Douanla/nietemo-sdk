import { describe, it, expect, vi } from 'vitest';
import { createClient } from '../src';

describe('NietemoClient Collection Operations', () => {
  it('should query and normalize documents on find()', async () => {
    const mockRecords = [
      {
        id: 'rec_1',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        data: { name: 'iPhone 15', price: 650000 },
      },
      {
        id: 'rec_2',
        createdAt: '2026-01-02T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        data: { name: 'AirPods Pro', price: 150000 },
      },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        collection: 'products',
        total: 2,
        records: mockRecords,
      }),
    });

    const client = createClient({
      appId: 'app_123',
      fetch: mockFetch,
    });

    interface Product {
      id: string;
      name: string;
      price: number;
    }

    const products = await client.collection<Product>('products').find();

    expect(products).toHaveLength(2);
    expect(products[0].id).toBe('rec_1');
    expect(products[0].name).toBe('iPhone 15');
    expect(products[0].price).toBe(650000);
    expect(products[1].id).toBe('rec_2');
    expect(products[1].name).toBe('AirPods Pro');
  });

  it('should insert document with nested data format expected by Nietemo server', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        record: {
          id: 'rec_new',
          createdAt: '2026-01-03T00:00:00Z',
          updatedAt: '2026-01-03T00:00:00Z',
          data: { title: 'New Item', quantity: 5 },
        },
      }),
    });

    const client = createClient({ appId: 'app_123', fetch: mockFetch });
    const inserted = await client.collection('items').insert({
      title: 'New Item',
      quantity: 5,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.nietemo.site/api/apps/app_123/baas/items');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ data: { title: 'New Item', quantity: 5 } });

    expect(inserted.id).toBe('rec_new');
    expect(inserted.title).toBe('New Item');
    expect(inserted.quantity).toBe(5);
  });

  it('should update document by ID via PATCH', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        record: {
          id: 'rec_existing',
          data: { stock: 20 },
        },
      }),
    });

    const client = createClient({ appId: 'app_123', fetch: mockFetch });
    const updated = await client.collection('items').update('rec_existing', { stock: 20 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ id: 'rec_existing', data: { stock: 20 } });
    expect(updated.id).toBe('rec_existing');
    expect(updated.stock).toBe(20);
  });

  it('should delete document by ID via DELETE', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, deletedId: 'rec_to_delete' }),
    });

    const client = createClient({ appId: 'app_123', fetch: mockFetch });
    const success = await client.collection('items').delete('rec_to_delete');

    expect(success).toBe(true);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('id=rec_to_delete');
    expect(init.method).toBe('DELETE');
  });
});
