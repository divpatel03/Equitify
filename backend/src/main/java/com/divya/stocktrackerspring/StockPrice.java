package com.divya.stocktrackerspring;

import org.springframework.stereotype.Component;

@Component
public class StockPrice {
    private String symbol;
    private Double price;

    public StockPrice() {}

    public StockPrice(String symbol, Double price) {
        this.symbol = symbol;
        this.price = price;
    }

    // Getters and Setters
    public String getSymbol() {
        return symbol;
    }

    public void setSymbol(String symbol) {
        this.symbol = symbol;
    }

    public Double getPrice() {
        return price;
    }

    public void setPrice(Double price) {
        this.price = price;
    }
}

