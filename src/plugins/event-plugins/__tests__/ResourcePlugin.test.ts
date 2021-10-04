import {
    scriptResourceEvent,
    imageResourceEvent,
    cssResourceEvent,
    performanceEvent,
    mockPerformanceObserver,
    mockPerformanceObject,
    mockPerformanceObjectWithResources,
    resourceEvent
} from '../../../test-utils/mock-data';
import { defaultRepConfig, ResourcePlugin } from '../ResourcePlugin';
import { mockRandom } from 'jest-mock-random';
import { context, record } from '../../../test-utils/test-utils';
import { PERFORMANCE_RESOURCE_EVENT_TYPE } from '../../utils/constant';

const DATA_PLANE_URL = 'https://dataplane.us-west-2.beta.rum.aws.dev';

const buildResourcePlugin = () => {
    return new ResourcePlugin(DATA_PLANE_URL);
};

describe('ResourcePlugin tests', () => {
    beforeEach(() => {
        (window as any).performance = performanceEvent.performance();
        (window as any).PerformanceObserver =
            performanceEvent.PerformanceObserver;
        record.mockClear();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('When resource event is present then event is recorded', async () => {
        // Setup
        mockRandom(0); // Retain order in shuffle

        const plugin: ResourcePlugin = buildResourcePlugin();

        // Run
        plugin.load(context);
        window.dispatchEvent(new Event('load'));
        plugin.disable();

        // Assert
        expect(record.mock.calls[0][0]).toEqual(
            PERFORMANCE_RESOURCE_EVENT_TYPE
        );
        expect(record.mock.calls[0][1]).toEqual(
            expect.objectContaining({
                targetUrl: resourceEvent.name,
                duration: resourceEvent.duration,
                startTime: resourceEvent.startTime
            })
        );
    });

    test('when resource is from data plane endpoint then resource event is not recorded', async () => {
        // Setup
        mockPerformanceObject();
        mockPerformanceObserver();

        const plugin: ResourcePlugin = buildResourcePlugin();

        // Run
        plugin.load(context);
        window.dispatchEvent(new Event('load'));
        plugin.disable();

        // Assert
        expect(record).not.toHaveBeenCalled();
    });

    test('when enabled then events are recorded', async () => {
        // Setup
        const plugin: ResourcePlugin = buildResourcePlugin();

        // Run
        plugin.load(context);
        plugin.disable();
        plugin.enable();
        window.dispatchEvent(new Event('load'));
        plugin.disable();

        // Assert
        expect(record).toHaveBeenCalled();
    });

    test('when disabled then no events are recorded', async () => {
        // Setup
        const plugin: ResourcePlugin = buildResourcePlugin();

        // Run
        plugin.load(context);
        plugin.disable();
        window.dispatchEvent(new Event('load'));
        plugin.disable();

        // Assert
        expect(record).toHaveBeenCalledTimes(0);
    });

    test('when event limit is reached no more events are recorded', async () => {
        // Setup
        mockPerformanceObjectWithResources();
        mockPerformanceObserver();

        const plugin: ResourcePlugin = buildResourcePlugin();
        plugin.configure({ ...defaultRepConfig, ...{ eventLimit: 1 } });

        // Run
        plugin.load(context);
        window.dispatchEvent(new Event('load'));
        plugin.disable();

        // Assert
        expect(record).toHaveBeenCalledTimes(1);
    });

    test('when resources > eventLimit then recordAll events are prioritized', async () => {
        // Setup
        mockRandom(0); // Reverse order in shuffle
        mockPerformanceObjectWithResources();
        mockPerformanceObserver();

        // Run
        const plugin: ResourcePlugin = buildResourcePlugin();
        plugin.configure({ ...defaultRepConfig, ...{ eventLimit: 1 } });

        plugin.load(context);
        window.dispatchEvent(new Event('load'));

        plugin.disable();

        // Assert
        expect(record.mock.calls[0][0]).toEqual(
            PERFORMANCE_RESOURCE_EVENT_TYPE
        );
        expect(record.mock.calls[0][1]).toEqual(
            expect.objectContaining({
                targetUrl: scriptResourceEvent.name
            })
        );
    });

    test('sampled events are randomized', async () => {
        // Setup
        mockPerformanceObjectWithResources();
        mockPerformanceObserver();

        const plugin: ResourcePlugin = buildResourcePlugin();
        plugin.configure({ ...defaultRepConfig, ...{ eventLimit: 3 } });

        // Run
        plugin.load(context);

        mockRandom(0.99); // Retain order in shuffle
        window.dispatchEvent(new Event('load'));
        mockRandom(0); // Reverse order in shuffle
        window.dispatchEvent(new Event('load'));

        plugin.disable();

        // Assert
        expect(record.mock.calls[1][1]).toEqual(
            expect.objectContaining({
                targetUrl: cssResourceEvent.name
            })
        );
        expect(record.mock.calls[2][1]).toEqual(
            expect.objectContaining({
                targetUrl: imageResourceEvent.name
            })
        );
        expect(record.mock.calls[4][1]).toEqual(
            expect.objectContaining({
                targetUrl: imageResourceEvent.name
            })
        );
        expect(record.mock.calls[5][1]).toEqual(
            expect.objectContaining({
                targetUrl: cssResourceEvent.name
            })
        );
    });
});