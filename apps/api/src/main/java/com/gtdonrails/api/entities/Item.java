package com.gtdonrails.api.entities;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import com.gtdonrails.api.enums.ItemStatus;
import com.gtdonrails.api.persistence.converters.BodyConverter;
import com.gtdonrails.api.persistence.converters.DurationMinutesConverter;
import com.gtdonrails.api.persistence.converters.TitleConverter;
import com.gtdonrails.api.types.Body;
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
import lombok.Setter;

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

    @Setter
    @Convert(converter = BodyConverter.class)
    @Column(columnDefinition = "text")
    private Body body;

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

    public Item(Title title, Body body) {
        this(title, body, null, null);
    }

    public Item(Title title, Body body, BigDecimal energy) {
        this(title, body, energy, null);
    }

    public Item(Title title, Body body, BigDecimal energy, Duration time) {
        setTitle(title);
        setBody(body);
        setEnergy(energy);
        setTime(time);
    }

    public void setTitle(Title title) {
        if (title == null) {
            throw new IllegalArgumentException("item title value 'null' is invalid; expected Title");
        }

        this.title = title;
    }

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

    public void addContext(Context context) {
        if (context == null) {
            throw new IllegalArgumentException("context value 'null' is invalid; expected Context");
        }

        contexts.add(context);
        context.getItems().add(this);
    }

    public void removeContext(Context context) {
        if (context == null) {
            return;
        }

        contexts.remove(context);
        context.getItems().remove(this);
    }

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
