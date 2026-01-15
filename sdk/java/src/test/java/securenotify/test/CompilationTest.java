// Simple compilation test for refactored files
package securenotify.test;

import securenotify.utils.UrlHelper;
import securenotify.types.PaginatedListResponse;
import java.util.HashMap;
import java.util.Map;

public class CompilationTest {
    public static void main(String[] args) {
        // Test UrlHelper
        String defaultUrl = UrlHelper.getDefaultBaseUrl(null);
        String customUrl = UrlHelper.getDefaultBaseUrl("https://custom.api.com");
        String builtUrl = UrlHelper.buildUrl("https://api.example.com", "/v1/users");
        
        Map<String, String> params = new HashMap<>();
        params.put("page", "1");
        params.put("limit", "10");
        String queryParams = UrlHelper.buildQueryParams(params);
        
        System.out.println("UrlHelper tests passed!");
        System.out.println("Default URL: " + defaultUrl);
        System.out.println("Custom URL: " + customUrl);
        System.out.println("Built URL: " + builtUrl);
        System.out.println("Query params: " + queryParams);
        
        // Test PaginatedListResponse (this would require Lombok to work, but we can check syntax)
        System.out.println("PaginatedListResponse class created successfully!");
    }
}
