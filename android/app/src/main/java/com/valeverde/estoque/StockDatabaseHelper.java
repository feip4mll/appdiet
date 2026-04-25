package com.valeverde.estoque;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Iterator;
import java.util.UUID;

public class StockDatabaseHelper extends SQLiteOpenHelper {
  private static final String TAG = "StockDatabaseHelper";
  private static final String DATABASE_NAME = "vale_verde_estoque.db";
  private static final int DATABASE_VERSION = 1;

  private static final String TABLE_META = "app_meta";
  private static final String TABLE_ITEMS = "stock_items";

  public StockDatabaseHelper(Context context) {
    super(context, DATABASE_NAME, null, DATABASE_VERSION);
  }

  @Override
  public void onCreate(SQLiteDatabase database) {
    database.execSQL(
      "CREATE TABLE " + TABLE_META + " (" +
      "meta_key TEXT PRIMARY KEY, " +
      "meta_value TEXT NOT NULL" +
      ")"
    );

    database.execSQL(
      "CREATE TABLE " + TABLE_ITEMS + " (" +
      "item_id TEXT PRIMARY KEY, " +
      "date_key TEXT NOT NULL, " +
      "product TEXT NOT NULL, " +
      "category TEXT NOT NULL, " +
      "quantity REAL NOT NULL, " +
      "unit TEXT NOT NULL, " +
      "operator_name TEXT NOT NULL, " +
      "updated_at TEXT NOT NULL, " +
      "sort_order INTEGER NOT NULL" +
      ")"
    );

    database.execSQL(
      "CREATE INDEX idx_stock_items_date_key ON " +
      TABLE_ITEMS +
      " (date_key, sort_order)"
    );
  }

  @Override
  public void onUpgrade(SQLiteDatabase database, int oldVersion, int newVersion) {
    database.execSQL("DROP TABLE IF EXISTS " + TABLE_ITEMS);
    database.execSQL("DROP TABLE IF EXISTS " + TABLE_META);
    onCreate(database);
  }

  public synchronized String loadStateJson() {
    SQLiteDatabase database = getReadableDatabase();
    JSONObject root = new JSONObject();
    JSONObject days = new JSONObject();

    try {
      root.put("companyName", getMetaValue(database, "companyName", "Vale Verde"));
      root.put("selectedDate", getMetaValue(database, "selectedDate", ""));

      Cursor cursor = database.query(
        TABLE_ITEMS,
        new String[] {
          "item_id",
          "date_key",
          "product",
          "category",
          "quantity",
          "unit",
          "operator_name",
          "updated_at"
        },
        null,
        null,
        null,
        null,
        "date_key ASC, sort_order ASC"
      );

      try {
        while (cursor.moveToNext()) {
          String dateKey = cursor.getString(cursor.getColumnIndexOrThrow("date_key"));
          JSONObject dayRecord = days.optJSONObject(dateKey);
          JSONArray items;

          if (dayRecord == null) {
            dayRecord = new JSONObject();
            items = new JSONArray();
            dayRecord.put("items", items);
            days.put(dateKey, dayRecord);
          } else {
            items = dayRecord.getJSONArray("items");
          }

          JSONObject item = new JSONObject();
          item.put("id", cursor.getString(cursor.getColumnIndexOrThrow("item_id")));
          item.put("product", cursor.getString(cursor.getColumnIndexOrThrow("product")));
          item.put("category", cursor.getString(cursor.getColumnIndexOrThrow("category")));
          item.put("quantity", cursor.getDouble(cursor.getColumnIndexOrThrow("quantity")));
          item.put("unit", cursor.getString(cursor.getColumnIndexOrThrow("unit")));
          item.put("operator", cursor.getString(cursor.getColumnIndexOrThrow("operator_name")));
          item.put("updatedAt", cursor.getString(cursor.getColumnIndexOrThrow("updated_at")));
          items.put(item);
        }
      } finally {
        cursor.close();
      }

      root.put("days", days);
    } catch (JSONException exception) {
      Log.e(TAG, "Falha ao montar estado do banco.", exception);
      return "{\"companyName\":\"Vale Verde\",\"selectedDate\":\"\",\"days\":{}}";
    }

    return root.toString();
  }

  public synchronized boolean saveStateJson(String stateJson) {
    SQLiteDatabase database = getWritableDatabase();

    try {
      JSONObject root = new JSONObject(stateJson);
      JSONObject days = root.optJSONObject("days");
      long sortOrder = 1L;

      database.beginTransaction();
      database.delete(TABLE_ITEMS, null, null);
      database.delete(TABLE_META, null, null);

      upsertMetaValue(database, "companyName", root.optString("companyName", "Vale Verde"));
      upsertMetaValue(database, "selectedDate", root.optString("selectedDate", ""));

      if (days != null) {
        Iterator<String> dayKeys = days.keys();

        while (dayKeys.hasNext()) {
          String dateKey = dayKeys.next();
          JSONObject dayRecord = days.optJSONObject(dateKey);
          JSONArray items = dayRecord != null ? dayRecord.optJSONArray("items") : null;

          if (items == null) {
            continue;
          }

          for (int index = 0; index < items.length(); index += 1) {
            JSONObject item = items.optJSONObject(index);
            if (item == null) {
              continue;
            }

            String product = item.optString("product", "").trim();
            double quantity = item.optDouble("quantity", 0);

            if (product.isEmpty() || quantity < 0) {
              continue;
            }

            ContentValues values = new ContentValues();
            values.put("item_id", item.optString("id", UUID.randomUUID().toString()));
            values.put("date_key", dateKey);
            values.put("product", product);
            values.put("category", item.optString("category", "Outros"));
            values.put("quantity", quantity);
            values.put("unit", item.optString("unit", "kg"));
            values.put("operator_name", item.optString("operator", "Equipe"));
            values.put("updated_at", item.optString("updatedAt", ""));
            values.put("sort_order", sortOrder);

            database.insertOrThrow(TABLE_ITEMS, null, values);
            sortOrder += 1L;
          }
        }
      }

      database.setTransactionSuccessful();
      return true;
    } catch (JSONException exception) {
      Log.e(TAG, "Falha ao salvar estado no banco.", exception);
      return false;
    } finally {
      if (database.inTransaction()) {
        database.endTransaction();
      }
    }
  }

  private String getMetaValue(SQLiteDatabase database, String key, String fallbackValue) {
    Cursor cursor = database.query(
      TABLE_META,
      new String[] { "meta_value" },
      "meta_key = ?",
      new String[] { key },
      null,
      null,
      null,
      "1"
    );

    try {
      if (!cursor.moveToFirst()) {
        return fallbackValue;
      }

      return cursor.getString(cursor.getColumnIndexOrThrow("meta_value"));
    } finally {
      cursor.close();
    }
  }

  private void upsertMetaValue(SQLiteDatabase database, String key, String value) {
    ContentValues values = new ContentValues();
    values.put("meta_key", key);
    values.put("meta_value", value);

    database.insertWithOnConflict(
      TABLE_META,
      null,
      values,
      SQLiteDatabase.CONFLICT_REPLACE
    );
  }
}
