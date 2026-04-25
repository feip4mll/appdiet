package com.valeverde.estoque;

import android.webkit.JavascriptInterface;

public class StockJavascriptBridge {
  private final StockDatabaseHelper stockDatabaseHelper;

  public StockJavascriptBridge(StockDatabaseHelper stockDatabaseHelper) {
    this.stockDatabaseHelper = stockDatabaseHelper;
  }

  @JavascriptInterface
  public String loadState() {
    return stockDatabaseHelper.loadStateJson();
  }

  @JavascriptInterface
  public boolean saveState(String stateJson) {
    return stockDatabaseHelper.saveStateJson(stateJson);
  }
}
