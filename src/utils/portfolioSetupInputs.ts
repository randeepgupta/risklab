import type {PortfolioPosition} from '../types/risk';
import {createListedPosition,type ListedSymbol} from './symbolDirectory';

export interface AllocationInput {ticker:string;allocation:string;name?:string;symbol?:ListedSymbol;sourceInvestment?:number;sourceAllocation?:string}
export function createAllocationInputs(positions:PortfolioPosition[],total:number):AllocationInput[] {
  return positions.map(position=>{
    const allocation=String(Number((position.investment/total*100).toPrecision(12)));
    return {ticker:position.ticker,name:position.name,allocation,sourceAllocation:allocation,sourceInvestment:position.investment};
  });
}
export function buildAllocationPositions(rows:AllocationInput[],total:number,originalTotal:number):PortfolioPosition[] {
  return rows.map(row=>{
    // Display rounding must not alter an imported or saved amount just because
    // the user opens Edit and analyzes again without changing that allocation.
    const investment=total===originalTotal&&row.sourceInvestment!==undefined&&row.allocation===row.sourceAllocation
      ? row.sourceInvestment : total*Number(row.allocation)/100;
    const symbol=row.symbol??{ticker:row.ticker,name:row.name??row.ticker,kind:'Stock' as const,exchange:''};
    return createListedPosition(symbol,investment,investment/total,undefined,true);
  });
}
