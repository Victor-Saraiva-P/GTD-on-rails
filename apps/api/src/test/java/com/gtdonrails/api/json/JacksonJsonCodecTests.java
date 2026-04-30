package com.gtdonrails.api.json;

import static com.gtdonrails.api.types.BodyFixtures.paragraphBody;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.gtdonrails.api.types.Body;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class JacksonJsonCodecTests {

    private final JsonCodec jsonCodec = new JacksonJsonCodec();

    @Test
    void writesAndReadsJson() {
        Body body = paragraphBody("Capture idea");

        String json = jsonCodec.write(body);
        Body decodedBody = jsonCodec.read(json, Body.class);

        assertEquals(body, decodedBody);
    }

    @Test
    void wrapsMalformedJsonFailures() {
        JsonCodecException exception = assertThrows(
            JsonCodecException.class,
            () -> jsonCodec.read("{not-json", Body.class));

        assertEquals("JSON parsing failed", exception.getMessage());
    }

    @Test
    void convertsValuesToMapBackedJsonObjects() {
        Body body = paragraphBody("Capture idea");

        assertEquals(Body.CURRENT_VERSION, jsonCodec.toMap(body).get("version"));
    }
}
