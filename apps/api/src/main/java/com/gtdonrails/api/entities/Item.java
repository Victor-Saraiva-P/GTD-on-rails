package com.gtdonrails.api.entities;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.normalizers.ItemBodyNormalizer;
import com.gtdonrails.api.persistence.converters.DurationMinutesConverter;
import com.gtdonrails.api.persistence.converters.ItemBodyConverter;
import com.gtdonrails.api.persistence.converters.TitleConverter;
import com.gtdonrails.api.types.ItemBody;
import com.gtdonrails.api.types.Title;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;

@Entity
@Table(name = "items")
@Getter
public class Item extends AuditableEntity {

    public static final int ENERGY_SCALE = 1;
    public static final String MIN_ENERGY_VALUE = "0.0";
    public static final String MAX_ENERGY_VALUE = "10.0";
    public static final BigDecimal MIN_ENERGY = new BigDecimal(MIN_ENERGY_VALUE);
    public static final BigDecimal MAX_ENERGY = new BigDecimal(MAX_ENERGY_VALUE);
    public static final String MIN_TIME_VALUE = "PT0M";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Convert(converter = TitleConverter.class)
    @Column(nullable = false, length = Title.MAX_LENGTH)
    private Title title;

    @Column(nullable = false, columnDefinition = "text")
    @Convert(converter = ItemBodyConverter.class)
    private ItemBody body = ItemBody.empty();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private ItemStatus status;

    @Column(precision = 10, scale = ENERGY_SCALE)
    private BigDecimal energy;

    @Convert(converter = DurationMinutesConverter.class)
    @Column(name = "time_minutes")
    private Duration time;

    @ManyToMany
    @JoinTable(
        name = "item_contexts",
        joinColumns = @JoinColumn(name = "item_id"),
        inverseJoinColumns = @JoinColumn(name = "context_id")
    )
    private Set<Context> contexts = new HashSet<>();

    public Item() {
    }

    public Item(Title title, String body) {
        this(title, body, null, null);
    }

    public Item(Title title, String body, BigDecimal energy) {
        this(title, body, energy, null);
    }

    public Item(Title title, String body, BigDecimal energy, Duration time) {
        setTitle(title);
        setBody(new ItemBody(body, null, null, null));
        setEnergy(energy);
        setTime(time);
    }

    /**
     * Replaces the required item title after enforcing the title value object.
     *
     * <p>Example: {@code item.setTitle(new Title("Capture idea"))}.</p>
     */
    public void setTitle(Title title) {
        if (title == null) {
            throw new IllegalArgumentException("item title value 'null' is invalid; expected Title");
        }

        this.title = title;
    }

    /**
     * Stores optional item body metadata as a non-null value object.
     *
     * <p>Example: {@code item.setBody(ItemBody.empty())}.</p>
     */
    public void setBody(ItemBody body) {
        this.body = ItemBodyNormalizer.normalizeBodyValue(body);
    }

    /**
     * Stores optional energy after normalizing scale and validating range.
     *
     * <p>Example: {@code item.setEnergy(new BigDecimal("4.5"))}.</p>
     */
    public void setEnergy(BigDecimal energy) {
        if (energy == null) {
            this.energy = null;
            return;
        }

        BigDecimal normalizedEnergy = energy.stripTrailingZeros();
        requireAllowedEnergyScale(normalizedEnergy);
        normalizedEnergy = energy.setScale(ENERGY_SCALE);
        requireEnergyInRange(normalizedEnergy);

        this.energy = normalizedEnergy;
    }

    private void requireAllowedEnergyScale(BigDecimal energy) {
        if (energy.scale() > ENERGY_SCALE) {
            throw new IllegalArgumentException(
                "energy value '" + energy + "' is invalid; expected up to " + ENERGY_SCALE + " decimal place");
        }
    }

    private void requireEnergyInRange(BigDecimal energy) {
        if (energy.compareTo(MIN_ENERGY) < 0 || energy.compareTo(MAX_ENERGY) > 0) {
            throw new IllegalArgumentException(
                "energy value '" + energy + "' is invalid; expected between " + MIN_ENERGY_VALUE + " and " + MAX_ENERGY_VALUE);
        }
    }

    /**
     * Stores optional time estimates when they use whole-minute precision.
     *
     * <p>Example: {@code item.setTime(Duration.ofMinutes(90))}.</p>
     */
    public void setTime(Duration time) {
        if (time == null) {
            this.time = null;
            return;
        }

        if (time.isNegative()) {
            throw new IllegalArgumentException(
                "time value '" + time + "' is invalid; expected greater than or equal to " + MIN_TIME_VALUE);
        }

        if (time.getSeconds() % 60 != 0 || time.getNano() != 0) {
            throw new IllegalArgumentException(
                "time value '" + time + "' is invalid; expected whole-minute Duration");
        }

        this.time = time;
    }

    /**
     * Adds a context and keeps both sides of the item-context relation aligned.
     *
     * <p>Example: {@code item.addContext(context)}.</p>
     */
    public void addContext(Context context) {
        if (context == null) {
            throw new IllegalArgumentException("context value 'null' is invalid; expected Context");
        }

        contexts.add(context);
        context.getItems().add(this);
    }

    /**
     * Removes a context and keeps both sides of the item-context relation aligned.
     *
     * <p>Example: {@code item.removeContext(context)}.</p>
     */
    public void removeContext(Context context) {
        if (context == null) {
            return;
        }

        contexts.remove(context);
        context.getItems().remove(this);
    }

    /**
     * Replaces all contexts while preserving bidirectional relation consistency.
     *
     * <p>Example: {@code item.replaceContexts(Set.of(homeContext))}.</p>
     */
    public void replaceContexts(Set<Context> contexts) {
        Set<Context> currentContexts = new HashSet<>(this.contexts);

        currentContexts.forEach(this::removeContext);
        contexts.forEach(this::addContext);
    }

    @PrePersist
    void prePersist() {
        initializeAuditTimestamps();
        status = inferStatus();
    }

    @PreUpdate
    void preUpdate() {
        status = inferStatus();
        touchUpdatedAt();
    }

    private ItemStatus inferStatus() {
        return ItemStatus.STUFF;
    }
}
