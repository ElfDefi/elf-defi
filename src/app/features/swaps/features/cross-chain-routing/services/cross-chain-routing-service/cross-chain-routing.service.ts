import { TradeService } from '@features/swaps/core/services/trade-service/trade.service';
import {
  BlockchainName,
  CelerRubicCrossChainTrade,
  compareAddresses,
  CROSS_CHAIN_TRADE_TYPE,
  CrossChainIsUnavailableError,
  CrossChainManager,
  CrossChainTradeType,
  LifiCrossChainTrade,
  LowSlippageError,
  RubicSdkError,
  TRADE_TYPE,
  Web3Pure
} from 'rubic-sdk';
import { RubicCrossChainTradeProvider } from 'rubic-sdk/lib/features/cross-chain/providers/rubic-trade-provider/rubic-cross-chain-trade-provider';
import { CelerCrossChainTradeProvider } from 'rubic-sdk/lib/features/cross-chain/providers/celer-trade-provider/celer-cross-chain-trade-provider';
import { SymbiosisCrossChainTradeProvider } from 'rubic-sdk/lib/features/cross-chain/providers/symbiosis-trade-provider/symbiosis-cross-chain-trade-provider';
import { WrappedCrossChainTrade } from 'rubic-sdk/lib/features/cross-chain/providers/common/models/wrapped-cross-chain-trade';
import { RubicSdkService } from '@features/swaps/core/services/rubic-sdk-service/rubic-sdk.service';
import { SwapFormService } from '@features/swaps/features/main-form/services/swap-form-service/swap-form.service';
import { SettingsService } from '@features/swaps/features/main-form/services/settings-service/settings.service';
import { WalletConnectorService } from '@core/services/blockchain/wallets/wallet-connector-service/wallet-connector.service';
import { Inject, Injectable } from '@angular/core';
import { PriceImpactService } from '@core/services/price-impact/price-impact.service';
import BigNumber from 'bignumber.js';
import {
  CelerRubicTradeInfo,
  SymbiosisTradeInfo
} from '@features/swaps/features/cross-chain-routing/services/cross-chain-routing-service/models/cross-chain-trade-info';
import { SymbiosisCrossChainTrade } from 'rubic-sdk/lib/features/cross-chain/providers/symbiosis-trade-provider/symbiosis-cross-chain-trade';
import { SmartRouting } from '@features/swaps/features/cross-chain-routing/services/cross-chain-routing-service/models/smart-routing.interface';
import CrossChainIsUnavailableWarning from '@core/errors/models/cross-chain-routing/cross-chainIs-unavailable-warning';
import { ERROR_TYPE } from '@core/errors/models/error-type';
import { SwapManagerCrossChainCalculationOptions } from 'rubic-sdk/lib/features/cross-chain/models/swap-manager-cross-chain-options';
import { CrossChainOptions } from 'rubic-sdk/lib/features/cross-chain/models/cross-chain-options';
import { BehaviorSubject, forkJoin, from, Observable, of, Subscription } from 'rxjs';
import { IframeService } from '@core/services/iframe/iframe.service';
import { SWAP_PROVIDER_TYPE } from '@features/swaps/features/main-form/models/swap-provider-type';
import { RecentTrade } from '@app/shared/models/my-trades/recent-trades.interface';
import { RecentTradesStoreService } from '@app/core/services/recent-trades/recent-trades-store.service';
import { TuiDialogService } from '@taiga-ui/core';
import { SwapSchemeModalComponent } from '../../components/swap-scheme-modal/swap-scheme-modal.component';
import { PolymorpheusComponent } from '@tinkoff/ng-polymorpheus';
import { HeaderStore } from '@app/core/header/services/header.store';
import { SwapSchemeModalData } from '../../models/swap-scheme-modal-data.interface';
import { GoogleTagManagerService } from '@core/services/google-tag-manager/google-tag-manager.service';
import { CrossChainRoutingApiService } from '@core/services/backend/cross-chain-routing-api/cross-chain-routing-api.service';
import { shouldCalculateGas } from '@shared/models/blockchain/should-calculate-gas';
import { GasService } from '@core/services/gas-service/gas.service';
import { RubicError } from '@core/errors/models/rubic-error';
import { AuthService } from '@core/services/auth/auth.service';
import { Token } from '@shared/models/tokens/token';
import { distinctUntilChanged, filter, first, map, switchMap, tap } from 'rxjs/operators';
import { LifiCrossChainTradeProvider } from 'rubic-sdk/lib/features/cross-chain/providers/lifi-trade-provider/lifi-cross-chain-trade-provider';
import { CrossChainTradeProvider } from 'rubic-sdk/lib/features/cross-chain/providers/common/cross-chain-trade-provider';
import { TRADES_PROVIDERS } from '@shared/constants/common/trades-providers';
import { DebridgeCrossChainTrade } from 'rubic-sdk/lib/features/cross-chain/providers/debridge-trade-provider/debridge-cross-chain-trade';
import { DebridgeCrossChainTradeProvider } from 'rubic-sdk/lib/features/cross-chain/providers/debridge-trade-provider/debridge-cross-chain-trade-provider';
import { ViaCrossChainTrade } from 'rubic-sdk/lib/features/cross-chain/providers/via-trade-provider/via-cross-chain-trade';
import {
  CrossChainTrade,
  RangoCrossChainTrade,
  RangoCrossChainTradeProvider
} from 'rubic-sdk/lib/features';
import { CrossChainProviderTrade } from '@features/swaps/features/cross-chain-routing/services/cross-chain-routing-service/models/cross-chain-provider-trade';
import { TargetNetworkAddressService } from '@features/swaps/features/cross-chain-routing/components/target-network-address/services/target-network-address.service';
import { WrappedTradeOrNull } from 'rubic-sdk/lib/features/cross-chain/providers/common/models/wrapped-trade-or-null';
import { ProvidersListSortingService } from '@features/swaps/features/cross-chain-routing/services/providers-list-sorting-service/providers-list-sorting.service';

export type AllProviders = {
  readonly totalAmount: number;
  readonly data: ReadonlyArray<WrappedTradeOrNull & { rank: number }>;
};

@Injectable({
  providedIn: 'root'
})
export class CrossChainRoutingService extends TradeService {
  private static readonly crossChainProviders = [
    RubicCrossChainTradeProvider,
    CelerCrossChainTradeProvider,
    SymbiosisCrossChainTradeProvider,
    LifiCrossChainTradeProvider,
    DebridgeCrossChainTradeProvider,
    RangoCrossChainTradeProvider
  ];

  public static isSupportedBlockchain(blockchainName: BlockchainName): boolean {
    return Boolean(
      this.crossChainProviders.find(provider => provider.isSupportedBlockchain(blockchainName))
    );
  }

  private readonly _selectedProvider$ = new BehaviorSubject<CrossChainTradeType | null>(null);

  public setSelectedProvider(type: CrossChainTradeType): void {
    this._selectedProvider$.next(type);
  }

  public readonly selectedProvider$ = this._selectedProvider$.asObservable();

  private readonly _allProviders$ = new BehaviorSubject<AllProviders>({ totalAmount: 0, data: [] });

  public readonly allProviders$ = this._allProviders$
    .asObservable()
    .pipe(distinctUntilChanged((prev, curr) => prev.data.length === curr.data.length));

  private readonly defaultTimeout = 25_000;

  private _crossChainTrade: CrossChainTrade;

  public set crossChainTrade(value: CrossChainTrade) {
    this._crossChainTrade = value;
  }

  public get crossChainTrade(): CrossChainTrade {
    return this._crossChainTrade;
  }

  private readonly _dangerousProviders$ = new BehaviorSubject<CrossChainTradeType[]>([]);

  public readonly dangerousProviders$ = this._dangerousProviders$.asObservable();

  constructor(
    private readonly sdk: RubicSdkService,
    private readonly swapFormService: SwapFormService,
    private readonly settingsService: SettingsService,
    private readonly walletConnectorService: WalletConnectorService,
    private readonly iframeService: IframeService,
    private readonly recentTradesStoreService: RecentTradesStoreService,
    private readonly headerStore: HeaderStore,
    @Inject(TuiDialogService) private readonly dialogService: TuiDialogService,
    private readonly gtmService: GoogleTagManagerService,
    private readonly apiService: CrossChainRoutingApiService,
    private readonly gasService: GasService,
    private readonly authService: AuthService,
    private readonly targetNetworkAddressService: TargetNetworkAddressService,
    private readonly providersListSortingService: ProvidersListSortingService
  ) {
    super('cross-chain-routing');
  }

  public markProviderAsDangerous(type: CrossChainTradeType): void {
    this._dangerousProviders$.next([...this._dangerousProviders$.value, type]);
  }

  public unmarkProviderAsDangerous(type: CrossChainTradeType): void {
    const providers = this._dangerousProviders$.value.filter(providerType => providerType !== type);
    this._dangerousProviders$.next(providers);
  }

  public isSupportedBlockchains(
    fromBlockchain: BlockchainName,
    toBlockchain: BlockchainName
  ): boolean {
    return Boolean(
      Object.values(this.sdk.crossChain.tradeProviders).find((provider: CrossChainTradeProvider) =>
        provider.isSupportedBlockchains(fromBlockchain, toBlockchain)
      )
    );
  }

  public calculateTrade(
    userAuthorized: boolean,
    isViaDisabled: boolean
  ): Observable<CrossChainProviderTrade> {
    try {
      const { fromToken, fromAmount, toToken } = this.swapFormService.inputValue;
      const slippageTolerance = this.settingsService.crossChainRoutingValue.slippageTolerance / 100;
      const options: SwapManagerCrossChainCalculationOptions & CrossChainOptions = {
        fromSlippageTolerance: slippageTolerance / 2,
        toSlippageTolerance: slippageTolerance / 2,
        slippageTolerance,
        timeout: this.defaultTimeout,
        disabledProviders: isViaDisabled ? [CROSS_CHAIN_TRADE_TYPE.VIA] : []
      };
      return this.sdk.crossChain
        .calculateTradesReactively(fromToken, fromAmount.toString(), toToken, options)
        .pipe(
          switchMap(tradeData =>
            forkJoin([
              of(tradeData),
              this.providersListSortingService.currentSortingType$.pipe(first())
            ])
          ),
          tap(([tradeData, sortingType]) => {
            let sortedProviders: WrappedCrossChainTrade[];
            if (sortingType === 'smart') {
              sortedProviders = [...tradeData.data]
                .filter(provider => Boolean(provider.trade))
                .sort((a, b) => {
                  const bestProvider = CrossChainManager.chooseBestProvider(a, b);
                  return a.tradeType === bestProvider.tradeType ? -1 : 1;
                });
            } else {
              sortedProviders = [...tradeData.data]
                .filter(provider => Boolean(provider.trade))
                .sort((a, b) => b.trade.to.tokenAmount.comparedTo(a.trade.to.tokenAmount));
            }
            const rankedProviders = sortedProviders.map(provider => ({
              ...provider,
              rank: this._dangerousProviders$.value.includes(provider.tradeType) ? 0 : 1
            }));

            this._allProviders$.next({
              totalAmount: tradeData.total,
              data: rankedProviders
            });
          }),
          map(([tradeData]) => tradeData),
          filter(tradeData => {
            return tradeData.total === tradeData.calculated || tradeData.calculated === 0;
          }),
          switchMap(tradeData => {
            const bestProvider = this._selectedProvider$.value
              ? tradeData.data.find(
                  provider => provider.tradeType === this._selectedProvider$.value
                )
              : this._allProviders$.value.data[0];
            const trade = bestProvider?.trade;
            const error = bestProvider?.error;

            if (!trade && error) {
              return of({
                ...bestProvider,
                needApprove: false,
                totalProviders: tradeData.total,
                currentProviders: tradeData.calculated,
                smartRouting: null
              });
            }

            return from(
              userAuthorized && trade?.needApprove ? from(trade.needApprove()) : of(false)
            ).pipe(
              switchMap(async needApprove => {
                const smartRouting = await this.calculateSmartRouting(bestProvider);
                return {
                  ...bestProvider,
                  needApprove,
                  totalProviders: tradeData.total,
                  currentProviders: tradeData.calculated,
                  smartRouting
                };
              })
            );
          })
        );
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  public async createTrade(
    providerTrade: CrossChainProviderTrade,
    confirmCallback?: () => void
  ): Promise<void> {
    await this.walletConnectorService.checkSettings(providerTrade.trade?.from?.blockchain);
    if (!providerTrade?.trade) {
      throw new RubicError('Cross chain trade object not found.');
    }
    this.checkDeviceAndShowNotification();

    const form = this.swapFormService.inputValue;

    const onTransactionHash = (txHash: string) => {
      confirmCallback?.();

      const fromToken = compareAddresses(providerTrade?.trade?.from.address, form.fromToken.address)
        ? form.fromToken
        : (providerTrade?.trade?.from as unknown as Token); // @TODO change types
      const toToken = compareAddresses(providerTrade?.trade?.to.address, form.toToken.address)
        ? form.toToken
        : (providerTrade?.trade?.to as unknown as Token); // @TODO change types

      const timestamp = Date.now();

      const tradeData: RecentTrade = {
        srcTxHash: txHash,
        fromBlockchain: providerTrade?.trade.from?.blockchain,
        toBlockchain: providerTrade?.trade.to?.blockchain,
        fromToken,
        toToken,
        crossChainProviderType: providerTrade.tradeType,
        timestamp,
        bridgeType:
          providerTrade?.trade instanceof LifiCrossChainTrade ||
          providerTrade?.trade instanceof ViaCrossChainTrade ||
          providerTrade?.trade instanceof RangoCrossChainTrade
            ? providerTrade?.trade?.bridgeType
            : undefined,
        viaUuid:
          providerTrade?.trade instanceof ViaCrossChainTrade
            ? providerTrade?.trade.uuid
            : undefined,
        rangoRequestId:
          providerTrade?.trade instanceof RangoCrossChainTrade
            ? providerTrade?.trade.requestId
            : undefined
      };

      confirmCallback?.();

      if (providerTrade?.tradeType) {
        this.openSwapSchemeModal(providerTrade, txHash, timestamp);
      }

      this.recentTradesStoreService.saveTrade(this.authService.userAddress, tradeData);

      this.notifyGtmAfterSignTx(txHash);
    };

    const blockchain = providerTrade?.trade?.from?.blockchain as BlockchainName;
    const shouldCalculateGasPrice = shouldCalculateGas[blockchain];

    const receiverAddress =
      this.targetNetworkAddressService.targetAddress?.isValid &&
      this.targetNetworkAddressService.targetAddress?.value;
    const swapOptions = {
      onConfirm: onTransactionHash,
      ...(Boolean(shouldCalculateGasPrice) && {
        gasPrice: Web3Pure.toWei(await this.gasService.getGasPriceInEthUnits(blockchain))
      }),
      ...(receiverAddress && { receiverAddress: receiverAddress })
    };

    await providerTrade.trade.swap(swapOptions);

    this.showSuccessTrxNotification(providerTrade.tradeType);
  }

  /**
   * Gets trade info to show in transaction info panel.
   */
  public async getTradeInfo(): Promise<CelerRubicTradeInfo | SymbiosisTradeInfo> {
    if (!this._crossChainTrade) {
      return null;
    }

    const trade = this._crossChainTrade;
    const { estimatedGas } = trade;

    if (
      trade instanceof SymbiosisCrossChainTrade ||
      trade instanceof LifiCrossChainTrade ||
      trade instanceof DebridgeCrossChainTrade ||
      trade instanceof ViaCrossChainTrade ||
      trade instanceof RangoCrossChainTrade
    ) {
      return {
        estimatedGas,
        feeAmount: new BigNumber(1),
        feeTokenSymbol: 'USDC',
        feePercent: trade.feeInfo.platformFee.percent,
        priceImpact: trade.priceImpact ? String(trade.priceImpact) : '0',
        networkFee: new BigNumber(trade.feeInfo?.cryptoFee?.amount),
        networkFeeSymbol: trade.feeInfo?.cryptoFee?.tokenSymbol
      };
    }

    if (trade instanceof CelerRubicCrossChainTrade) {
      const { fromTrade, toTrade } = trade as CelerRubicCrossChainTrade;
      const fromProvider = fromTrade.provider.type;
      const toProvider = toTrade.provider.type;

      const priceImpactFrom = PriceImpactService.calculatePriceImpact(
        fromTrade.fromToken.price.toNumber(),
        fromTrade.toToken.price.toNumber(),
        fromTrade.fromToken.tokenAmount,
        fromTrade.toToken.tokenAmount
      );

      const priceImpactTo = PriceImpactService.calculatePriceImpact(
        toTrade.fromToken.price.toNumber(),
        toTrade.toToken.price.toNumber(),
        toTrade.fromToken.tokenAmount,
        toTrade.toToken.tokenAmount
      );

      return {
        feePercent: trade.feeInfo.platformFee.percent,
        feeAmount: new BigNumber(1),
        feeTokenSymbol: 'USDC',
        cryptoFee: new BigNumber(trade.feeInfo?.cryptoFee?.amount).toNumber(),
        estimatedGas,
        priceImpactFrom: Number.isNaN(priceImpactFrom) ? 0 : priceImpactFrom,
        priceImpactTo: Number.isNaN(priceImpactTo) ? 0 : priceImpactTo,
        fromProvider,
        toProvider,
        fromPath: null,
        toPath: null,
        usingCelerBridge: trade.type === CROSS_CHAIN_TRADE_TYPE.CELER
      };
    }

    throw new RubicError('[RUBIC SDK] Unknown trade provider.');
  }

  public async calculateSmartRouting(
    wrappedTrade: WrappedCrossChainTrade
  ): Promise<SmartRouting | null> {
    if (!wrappedTrade?.trade) {
      return null;
    }

    if (
      wrappedTrade.trade instanceof LifiCrossChainTrade ||
      wrappedTrade.trade instanceof ViaCrossChainTrade ||
      wrappedTrade.trade instanceof RangoCrossChainTrade
    ) {
      return {
        fromProvider: wrappedTrade.trade.itType.from,
        toProvider: wrappedTrade.trade.itType.to,
        bridgeProvider: wrappedTrade.trade.bridgeType
      };
    }
    if (wrappedTrade.trade.type === CROSS_CHAIN_TRADE_TYPE.SYMBIOSIS) {
      return {
        fromProvider: wrappedTrade.trade.itType.from,
        toProvider: wrappedTrade.trade.itType.to,
        bridgeProvider: CROSS_CHAIN_TRADE_TYPE.SYMBIOSIS
      };
    }
    if (wrappedTrade.trade.type === CROSS_CHAIN_TRADE_TYPE.DEBRIDGE) {
      return {
        fromProvider: TRADE_TYPE.ONE_INCH,
        toProvider: TRADE_TYPE.ONE_INCH,
        bridgeProvider: CROSS_CHAIN_TRADE_TYPE.DEBRIDGE
      };
    }
    if (wrappedTrade.trade instanceof CelerRubicCrossChainTrade) {
      return {
        fromProvider: wrappedTrade.trade.itType.from,
        toProvider: wrappedTrade.trade.itType.to,
        bridgeProvider:
          wrappedTrade.tradeType === CROSS_CHAIN_TRADE_TYPE.CELER
            ? CROSS_CHAIN_TRADE_TYPE.CELER
            : CROSS_CHAIN_TRADE_TYPE.RUBIC
      };
    }
    return null;
  }

  public async approve(wrappedTrade: WrappedCrossChainTrade): Promise<void> {
    this.checkDeviceAndShowNotification();
    let approveInProgressSubscription$: Subscription;

    const blockchain = wrappedTrade?.trade?.from?.blockchain as BlockchainName;
    const shouldCalculateGasPrice = shouldCalculateGas[blockchain];
    const swapOptions = {
      onTransactionHash: () => {
        approveInProgressSubscription$ = this.notificationsService.showApproveInProgress();
      },
      ...(Boolean(shouldCalculateGasPrice) && {
        gasPrice: Web3Pure.toWei(await this.gasService.getGasPriceInEthUnits(blockchain))
      })
    };

    const oldProvider = this._selectedProvider$.value;

    try {
      this._selectedProvider$.next(wrappedTrade.tradeType);
      await wrappedTrade.trade.approve(swapOptions);
      this.notificationsService.showApproveSuccessful();
    } catch (err) {
      this._selectedProvider$.next(oldProvider);
      throw err;
    } finally {
      approveInProgressSubscription$?.unsubscribe();
    }
  }

  public parseCalculationError(error: RubicSdkError): RubicError<ERROR_TYPE> {
    if (error instanceof CrossChainIsUnavailableError) {
      return new CrossChainIsUnavailableWarning();
    }
    if (error?.message?.includes('Representation of ')) {
      return new RubicError('The swap between this pair of blockchains is currently unavaible.');
    }
    if (error instanceof LowSlippageError) {
      return new RubicError('Slippage is too low for transaction.');
    }
    return new RubicError(
      'The swap between this pair of tokens is currently unavailable. Please try again later.'
    );
  }

  private checkDeviceAndShowNotification(): void {
    if (this.iframeService.isIframe && this.iframeService.device === 'mobile') {
      this.notificationsService.showOpenMobileWallet();
    }
  }

  private notifyGtmAfterSignTx(txHash: string): void {
    const { fromToken, toToken, fromAmount } = this.swapFormService.inputValue;

    // @TODO remove hardcode
    const fee = new BigNumber(1);

    this.gtmService.fireTxSignedEvent(
      SWAP_PROVIDER_TYPE.CROSS_CHAIN_ROUTING,
      txHash,
      fromToken.symbol,
      toToken.symbol,
      fee,
      fromAmount.multipliedBy(fromToken.price)
    );
  }

  public openSwapSchemeModal(
    providerTrade: CrossChainProviderTrade,
    txHash: string,
    timestamp: number
  ): void {
    const { fromBlockchain, toBlockchain, fromToken, toToken } = this.swapFormService.inputValue;

    const routing = providerTrade.smartRouting;
    const bridgeProvider = TRADES_PROVIDERS[routing.bridgeProvider];
    const fromTradeProvider = routing.fromProvider
      ? TRADES_PROVIDERS[routing.fromProvider]
      : {
          ...TRADES_PROVIDERS[routing.bridgeProvider],
          name: TRADES_PROVIDERS[routing.bridgeProvider].name + ' Pool'
        };
    const toTradeProvider = routing.toProvider
      ? TRADES_PROVIDERS[routing.toProvider]
      : {
          ...TRADES_PROVIDERS[routing.bridgeProvider],
          name: TRADES_PROVIDERS[routing.bridgeProvider].name + ' Pool'
        };

    const viaUuid =
      providerTrade.trade instanceof ViaCrossChainTrade ? providerTrade.trade.uuid : undefined;
    const rangoRequestId =
      providerTrade.trade instanceof RangoCrossChainTrade
        ? providerTrade.trade.requestId
        : undefined;

    this.dialogService
      .open<SwapSchemeModalData>(new PolymorpheusComponent(SwapSchemeModalComponent), {
        size: this.headerStore.isMobile ? 'page' : 'l',
        data: {
          fromToken,
          fromBlockchain,
          toToken,
          toBlockchain,
          srcProvider: fromTradeProvider,
          dstProvider: toTradeProvider,
          crossChainProvider: providerTrade.tradeType,
          srcTxHash: txHash,
          bridgeType: bridgeProvider,
          viaUuid,
          rangoRequestId,
          timestamp
        }
      })
      .subscribe();
  }
}
