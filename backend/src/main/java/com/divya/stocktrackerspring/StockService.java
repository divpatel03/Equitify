package com.divya.stocktrackerspring;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
@Service
public class StockService {

    private final String API_URL = "https://finnhub.io/api/v1/quote?symbol=";
    private final String API_TOKEN = "cp743jhr01qpb9rahbn0cp743jhr01qpb9rahbng"; // Replace with your actual API token

    public List<StockPrice> fetchStockPrices(List<String> stockSymbols) {
        HttpClient client = HttpClient.newHttpClient();

        return stockSymbols.stream().map(symbol -> {
            String url = API_URL + symbol;
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("X-Finnhub-Token", API_TOKEN)
                    .GET()
                    .build();

            try {
                HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
                return parseStockPrice(response.body(), symbol);
            } catch (Exception e) {
                e.printStackTrace();
                return new StockPrice(symbol, null);
            }
        }).collect(Collectors.toList());
    }

    private StockPrice parseStockPrice(String responseBody, String symbol) {
        // Assuming the response is JSON and contains a field "c" for the current price
        // You can use a JSON library like Jackson to parse this properly
        try {
         
            double price = new ObjectMapper().readTree(responseBody).get("c").asDouble();
            return new StockPrice(symbol, price);
        } catch (Exception e) {
            e.printStackTrace();
            return new StockPrice(symbol, null);
        }
    }
}
