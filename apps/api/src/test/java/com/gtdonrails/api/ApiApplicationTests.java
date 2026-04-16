package com.gtdonrails.api;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Tag;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(properties = {
	"gtd.persistence.bootstrap.enabled=false",
	"spring.datasource.url=jdbc:sqlite:file:context-test?mode=memory&cache=shared"
})
@ActiveProfiles("test")
@Tag("integration")
class ApiApplicationTests {

	@Test
	void contextLoads() {
	}

}
